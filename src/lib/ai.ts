import { GoogleGenAI, Type, type Tool } from '@google/genai';
import { APP_LANGUAGE } from '../constants';
import { eventsStore } from './storage';
import { isoDate, newEventId, todayDayIndex } from './calendar';
import type { CalendarEvent, ChatMessage, Day, EventType } from '../types';

// Cheapest stable Gemini model with reliable tool calling + generous
// free-tier RPM. Switch to 'gemini-2.5-flash' for marginally better quality
// on tricky multi-step calls, at 3x the price.
const MODEL = 'gemini-2.5-flash-lite';

export class AIError extends Error {
  cause?: unknown;
  status?: number;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AIError';
    this.cause = cause;
    if (cause && typeof cause === 'object') {
      const c = cause as { status?: unknown };
      if (typeof c.status === 'number') this.status = c.status;
    }
  }
}

function describeAIError(e: unknown): string {
  if (e instanceof AIError) return e.message;
  if (e && typeof e === 'object') {
    const o = e as { status?: unknown; message?: unknown; name?: unknown };
    const msg = typeof o.message === 'string' ? o.message : '';
    const status = typeof o.status === 'number' ? o.status : undefined;
    if (status === 429 || /quota|rate/i.test(msg)) {
      return 'Gemini rate limit hit (free tier ≈ 10 req/min). Give it a few seconds and try again.';
    }
    if (status === 400 || /invalid|malformed/i.test(msg)) {
      return `Gemini rejected the request: ${msg || '(no detail)'}`;
    }
    if (/safety|blocked|harm/i.test(msg)) {
      return 'Gemini blocked that turn for safety. Try rephrasing.';
    }
    if (status && status >= 500) return 'Gemini server hiccup. Try again.';
    if (msg) return msg;
  }
  return 'Unknown model error';
}

function getKey(): string {
  const k = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
    .WXT_GEMINI_API_KEY;
  if (!k) throw new AIError('WXT_GEMINI_API_KEY missing — set it in .env');
  return k;
}

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: getKey() });
  return _client;
}

const DAY_NAMES_LIST = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// ---- Calendar editing tools ----

const CALENDAR_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'addEvent',
        description: 'Add a single calendar event for the user.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Event title' },
            day: {
              type: Type.NUMBER,
              description: 'Day index 0=Monday..6=Sunday',
            },
            startMinutes: {
              type: Type.NUMBER,
              description: 'Start time minutes from midnight (0..1439)',
            },
            endMinutes: {
              type: Type.NUMBER,
              description: 'End time minutes from midnight, must be > startMinutes',
            },
            recurring: {
              type: Type.BOOLEAN,
              description: 'Repeat every week',
            },
            type: {
              type: Type.STRING,
              enum: ['fixed', 'task'],
              description:
                "'fixed' for classes/meetings/labs, 'task' for personal work that should trigger nudges",
            },
          },
          required: ['title', 'day', 'startMinutes', 'endMinutes', 'recurring', 'type'],
        },
      },
      {
        name: 'addEvents',
        description:
          'Add multiple events at once. ALWAYS prefer this for bulk schedule pastes.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            events: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  day: { type: Type.NUMBER },
                  startMinutes: { type: Type.NUMBER },
                  endMinutes: { type: Type.NUMBER },
                  recurring: { type: Type.BOOLEAN },
                  type: { type: Type.STRING, enum: ['fixed', 'task'] },
                },
                required: [
                  'title',
                  'day',
                  'startMinutes',
                  'endMinutes',
                  'recurring',
                  'type',
                ],
              },
            },
          },
          required: ['events'],
        },
      },
      {
        name: 'deleteEvent',
        description: 'Delete an event by id.',
        parameters: {
          type: Type.OBJECT,
          properties: { id: { type: Type.STRING } },
          required: ['id'],
        },
      },
      {
        name: 'updateEvent',
        description: 'Update fields on an existing event by id.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            day: { type: Type.NUMBER },
            startMinutes: { type: Type.NUMBER },
            endMinutes: { type: Type.NUMBER },
            recurring: { type: Type.BOOLEAN },
            type: { type: Type.STRING, enum: ['fixed', 'task'] },
            completed: { type: Type.BOOLEAN },
          },
          required: ['id'],
        },
      },
    ],
  },
];

export async function editCalendar(
  input: string,
  language: string = APP_LANGUAGE,
): Promise<{ message: string; mutations: number }> {
  const today = new Date();
  const dayName = DAY_NAMES_LIST[todayDayIndex(today)];
  const dateISO = isoDate(today);
  const events = await eventsStore.list();
  const eventsCompact = events.map((e) => ({
    id: e.id,
    title: e.title,
    day: e.day,
    startMinutes: e.startMinutes,
    endMinutes: e.endMinutes,
    recurring: e.recurring,
    type: e.type,
  }));

  const systemInstruction = `You are PlanFlow's calendar assistant.
Today is ${dateISO} (${dayName}). Day indices: 0=Monday, 1=Tuesday, ..., 6=Sunday.
The user's existing events: ${JSON.stringify(eventsCompact)}.
Parse the user's input and call the appropriate tools to mutate their calendar.
Rules:
- Multiple events at once -> use addEvents (single tool call).
- Times in 24-hour format. Convert HH:MM into minutes from midnight (e.g. 14:30 -> 870).
- Classify: classes/meetings/labs/lectures/tutorials -> 'fixed'. Personal tasks/study/work -> 'task'.
- If the user says "every Friday" or pastes a class schedule, set recurring=true.
- When the user says "tonight" or "this evening" without naming a day, assume today (${dayName}, index ${todayDayIndex(today)}).
- After all tool calls return, output ONE short sentence in ${language} confirming what changed (e.g. "Added 14 events.").`;

  let mutations = 0;

  try {
    const chatSession = client().chats.create({
      model: MODEL,
      config: {
        systemInstruction,
        tools: CALENDAR_TOOLS,
      },
    });

    let response = await chatSession.sendMessage({ message: input });

    let safety = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && safety < 8) {
      safety++;
      const responseParts = [] as Array<{
        functionResponse: { name: string; response: Record<string, unknown> };
      }>;
      for (const call of response.functionCalls) {
        const result = await runCalendarTool(call.name ?? '', call.args ?? {});
        if (result.mutated) mutations += result.mutated;
        responseParts.push({
          functionResponse: {
            name: call.name ?? 'unknown',
            response: { result: result.summary },
          },
        });
      }
      response = await chatSession.sendMessage({ message: responseParts });
    }

    const message =
      response.text?.trim() ||
      `Done — ${mutations} change${mutations === 1 ? '' : 's'}.`;
    return { message, mutations };
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError(describeAIError(e), e);
  }
}

async function runCalendarTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ summary: string; mutated: number }> {
  switch (name) {
    case 'addEvent': {
      const ev = normalizeEvent(args);
      if (!ev) return { summary: 'invalid event, skipped', mutated: 0 };
      await eventsStore.add(ev);
      return { summary: `added "${ev.title}" (id=${ev.id})`, mutated: 1 };
    }
    case 'addEvents': {
      const raw = Array.isArray((args as { events?: unknown }).events)
        ? ((args as { events: unknown[] }).events as unknown[])
        : [];
      const evs = raw
        .map((r) => normalizeEvent(r as Record<string, unknown>))
        .filter((e): e is CalendarEvent => e !== null);
      if (evs.length === 0) return { summary: 'no valid events', mutated: 0 };
      const current = await eventsStore.list();
      await eventsStore.save([...current, ...evs]);
      return {
        summary: `added ${evs.length} events: ${evs
          .map((e) => `"${e.title}"`)
          .join(', ')}`,
        mutated: evs.length,
      };
    }
    case 'deleteEvent': {
      const id = String((args as { id?: unknown }).id ?? '');
      const ok = await eventsStore.remove(id);
      return {
        summary: ok ? `deleted ${id}` : `event ${id} not found`,
        mutated: ok ? 1 : 0,
      };
    }
    case 'updateEvent': {
      const a = args as Record<string, unknown>;
      const id = String(a.id ?? '');
      const patch: Partial<CalendarEvent> = {};
      if (typeof a.title === 'string') patch.title = a.title;
      if (typeof a.day === 'number' && a.day >= 0 && a.day <= 6) patch.day = a.day as Day;
      if (typeof a.startMinutes === 'number') patch.startMinutes = a.startMinutes;
      if (typeof a.endMinutes === 'number') patch.endMinutes = a.endMinutes;
      if (typeof a.recurring === 'boolean') patch.recurring = a.recurring;
      if (a.type === 'fixed' || a.type === 'task') patch.type = a.type;
      if (typeof a.completed === 'boolean') patch.completed = a.completed;
      const updated = await eventsStore.update(id, patch);
      return {
        summary: updated ? `updated "${updated.title}"` : `event ${id} not found`,
        mutated: updated ? 1 : 0,
      };
    }
    default:
      return { summary: `unknown tool ${name}`, mutated: 0 };
  }
}

function normalizeEvent(args: Record<string, unknown> | null | undefined): CalendarEvent | null {
  if (!args) return null;
  const title = typeof args.title === 'string' ? args.title.trim() : '';
  if (!title) return null;
  const day = Number(args.day);
  const startMinutes = Number(args.startMinutes);
  const endMinutes = Number(args.endMinutes);
  if (!Number.isFinite(day) || day < 0 || day > 6) return null;
  if (!Number.isFinite(startMinutes) || startMinutes < 0 || startMinutes >= 1440)
    return null;
  if (!Number.isFinite(endMinutes) || endMinutes <= startMinutes || endMinutes > 1440)
    return null;
  const type: EventType = args.type === 'fixed' ? 'fixed' : 'task';
  return {
    id: newEventId(),
    title,
    day: day as Day,
    startMinutes,
    endMinutes,
    recurring: !!args.recurring,
    type,
    completed: false,
    createdAt: Date.now(),
  };
}

// ---- Chat (streaming) ----

export type ChatContext = {
  behaviorSummary: string;
  tasksSummary: string;
  existingEvents: CalendarEvent[];
  language?: string;
};

export async function* chatStream(
  messages: ChatMessage[],
  context: ChatContext,
): AsyncIterable<string> {
  const language = context.language ?? APP_LANGUAGE;
  const today = new Date();
  const dayName = DAY_NAMES_LIST[todayDayIndex(today)];
  const dateISO = isoDate(today);
  const eventsCompact = context.existingEvents.map((e) => ({
    id: e.id,
    title: e.title,
    day: e.day,
    startMinutes: e.startMinutes,
    endMinutes: e.endMinutes,
    recurring: e.recurring,
    type: e.type,
    completed: e.completed,
  }));

  const behaviorBlock = context.behaviorSummary
    ? context.behaviorSummary
    : '(no domains tracked yet today — either user just installed, has only been on internal pages like chrome:// or this extension, or has not been on any normal site for >1s today)';

  const systemInstruction = `You are PlanFlow, a friendly planning buddy living in the user's browser side panel. Tone: casual, short, slightly cheeky like a friend who's seen them procrastinate before. Never lecture, never moralize. Replies under 3 sentences unless they ask for detail.

Today is ${dateISO} (${dayName}). Day indices: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday.

Today's browsing (top 5 domains by time-on-site):
${behaviorBlock}

IMPORTANT about browsing data: you DO have access to it — it's the block above. If it's empty/parenthesized, the data simply has not accumulated yet today. Tell the user that honestly ("nothing's logged yet today, browse around a bit and check back"). NEVER say you "can't access" logs or "don't have permission" — you do have access, the dataset is just empty right now.

Today's tasks:
${context.tasksSummary || '(none scheduled today)'}

Full event list (id+fields): ${JSON.stringify(eventsCompact)}

CALENDAR TOOLS — addEvent / addEvents / updateEvent / deleteEvent. Whenever the user asks to schedule, change, or remove anything — even casually like "remind me to do X tomorrow" or "drop my Tuesday class" — you MUST call the tool, not just describe the change.

RECURRING-PATTERN EXPANSION (very important — interpret these expansively, never literally):
- "every day" / "every night" / "daily" / "her gün" / "her gece" → call addEvents with 7 events (day 0,1,2,3,4,5,6), recurring=true on EACH.
- "every weekday" / "weekdays" / "haftaiçi" → addEvents with 5 events (day 0,1,2,3,4), recurring=true.
- "every weekend" / "weekends" / "haftasonu" → addEvents with 2 events (day 5,6), recurring=true.
- "every Monday/Tuesday/…" / "her pazartesi/salı/…" → 1 event on that day, recurring=true.
- "tonight" / "this evening" / "bu gece" / "bu akşam" without a named day → today (day ${todayDayIndex(today)}), recurring=false.
- "tomorrow" / "yarın" → today+1 mod 7.
- A bare time without "every"/"her" → 1 event, recurring=false.

DEFAULT DURATIONS when the user gives only a start time:
- sleep / wake / alarm / "go to bed": 30 minutes (it's a marker).
- breakfast / lunch / dinner / coffee: 45 minutes.
- exercise / gym / yoga / run / walk: 60 minutes.
- study / work / read / write / project: 60 minutes.
- class / lecture / meeting / lab: 60 minutes.
- anything else not obvious: 60 minutes.
Pick reasonable defaults silently — do not ask the user unless it's truly ambiguous.

NO SPANNING MIDNIGHT — events must end the same day. If the user says "sleep at 10pm to 7am", break it: put a "Sleep" task 22:00-23:30 today and skip the morning side, OR ask. For "sleep at 10pm" alone, use 22:00-22:30 as a bedtime marker.

TIME ENCODING — minutes from midnight. 22:00 → 1320, 14:30 → 870.

CLASSIFICATION:
- 'fixed' = externally-imposed: classes, lectures, meetings, labs, scheduled appointments.
- 'task' = self-imposed: study, work, exercise, sleep, errands, reading. Tasks trigger procrastination nudges; fixed events do not.

After tool calls run, send ONE short confirmation sentence in ${language} ("Set 7 bedtime markers, every night at 10pm.").

When NOT mutating the calendar, chat naturally — under 3 sentences. Reply in ${language}.`;

  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') return;
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  try {
    const session = client().chats.create({
      model: MODEL,
      config: { systemInstruction, tools: CALENDAR_TOOLS },
      history,
    });

    let pendingMessage: string | Array<{
      functionResponse: { name: string; response: Record<string, unknown> };
    }> = last.content;
    let mutations = 0;
    let textEmitted = false;

    let safety = 0;
    while (safety++ < 6) {
      const stream = await session.sendMessageStream({ message: pendingMessage });
      const collectedCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

      for await (const chunk of stream) {
        if (chunk.text) {
          textEmitted = true;
          yield chunk.text;
        }
        const calls = chunk.functionCalls;
        if (calls && calls.length > 0) {
          for (const c of calls) {
            collectedCalls.push({
              name: c.name ?? '',
              args: (c.args ?? {}) as Record<string, unknown>,
            });
          }
        }
      }

      if (collectedCalls.length === 0) break;

      const responseParts = [];
      for (const call of collectedCalls) {
        const result = await runCalendarTool(call.name, call.args);
        if (result.mutated) mutations += result.mutated;
        responseParts.push({
          functionResponse: {
            name: call.name || 'unknown',
            response: { result: result.summary },
          },
        });
      }
      pendingMessage = responseParts;
    }

    if (!textEmitted && mutations > 0) {
      yield `Done — ${mutations} change${mutations === 1 ? '' : 's'} applied.`;
    }
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError(describeAIError(e), e);
  }
}

// ---- Nudge ----

export type NudgeContext = {
  taskTitle: string;
  taskEndHHMM: string;
  domain: string;
  minutesOnSite: number;
  language?: string;
};

export async function generateNudge(ctx: NudgeContext): Promise<string> {
  const language = ctx.language ?? APP_LANGUAGE;
  const prompt = `Generate exactly 1 sentence in ${language}, max 20 words, that gently calls out a procrastinating user.
The user has scheduled task "${ctx.taskTitle}" active until ${ctx.taskEndHHMM}.
Right now they've been on ${ctx.domain} for ${Math.round(ctx.minutesOnSite)} minutes.
Tone: a warm friend, slightly cheeky, no lecturing. No emojis. No quotes. Just the sentence.`;
  try {
    const result = await client().models.generateContent({
      model: MODEL,
      contents: prompt,
    });
    const text = result.text?.trim() || `Hey, "${ctx.taskTitle}" is waiting on you.`;
    return stripQuotes(text);
  } catch (e) {
    throw new AIError(describeAIError(e), e);
  }
}

// ---- Insight ----

export type InsightContext = {
  weeklyAggregate: string;
  tasksCompleted: number;
  tasksScheduled: number;
  language?: string;
};

export async function generateInsight(ctx: InsightContext): Promise<string> {
  const language = ctx.language ?? APP_LANGUAGE;
  const prompt = `Output exactly 2-3 sentences in ${language}. Observe patterns in this week's data. Mention specific times-of-day if relevant. Matter-of-fact friend tone, zero judgment.

Data:
${ctx.weeklyAggregate}

Tasks completed: ${ctx.tasksCompleted}/${ctx.tasksScheduled}`;
  try {
    const result = await client().models.generateContent({
      model: MODEL,
      contents: prompt,
    });
    return result.text?.trim() || 'Not enough data this week.';
  } catch (e) {
    throw new AIError(describeAIError(e), e);
  }
}

function stripQuotes(s: string): string {
  return s.replace(/^["'`]+|["'`]+$/g, '').trim();
}
