import { useEffect, useState } from 'react';
import { Avatar } from '../../src/components/Avatar';
import { ChatBox } from '../../src/components/ChatBox';
import { Toast, type ToastState } from '../../src/components/Toast';
import { useChat } from '../../src/state/chat';
import { useTasks } from '../../src/state/tasks';
import { chatStream, AIError } from '../../src/lib/ai';
import {
  summarizeBehaviorToday,
  summarizeTasksToday,
} from '../../src/lib/insights';

const CONTEXT_TURNS = 10;

export default function App() {
  const messages = useChat((s) => s.messages);
  const sending = useChat((s) => s.sending);
  const load = useChat((s) => s.load);
  const appendUser = useChat((s) => s.appendUser);
  const appendAssistantPlaceholder = useChat((s) => s.appendAssistantPlaceholder);
  const appendAssistantChunk = useChat((s) => s.appendAssistantChunk);
  const finalizeAssistant = useChat((s) => s.finalizeAssistant);
  const setSending = useChat((s) => s.setSending);

  const clearChat = useChat((s) => s.clear);

  const taskEvents = useTasks((s) => s.events);
  const loadTasks = useTasks((s) => s.load);

  const [toast, setToast] = useState<ToastState>(null);

  const onNewChat = async () => {
    if (sending) return;
    if (messages.length === 0) return;
    if (!confirm('Start a new chat? Current conversation will be cleared.')) return;
    await clearChat();
    setToast({ kind: 'info', message: 'new chat started' });
  };

  useEffect(() => {
    load();
    loadTasks();
  }, [load, loadTasks]);

  const openDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  };

  const onSend = async (text: string) => {
    if (sending) return;
    setSending(true);
    await appendUser(text);
    const placeholder = appendAssistantPlaceholder();

    try {
      const behaviorSummary = await summarizeBehaviorToday();
      const tasksSummary = summarizeTasksToday(taskEvents);
      const recent = useChat.getState().messages.slice(-CONTEXT_TURNS - 1, -1);
      // recent already includes the just-appended user message; placeholder is excluded by slice end -1
      const stream = chatStream(recent, {
        behaviorSummary,
        tasksSummary,
        existingEvents: taskEvents,
      });
      for await (const chunk of stream) {
        appendAssistantChunk(placeholder.id, chunk);
      }
      await finalizeAssistant(placeholder.id);
    } catch (e) {
      const msg =
        e instanceof AIError ? e.message : 'Something went wrong with the model.';
      appendAssistantChunk(placeholder.id, ` (error: ${msg})`);
      await finalizeAssistant(placeholder.id);
      setToast({ kind: 'err', message: msg });
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <header className="border-b border-border px-4 py-2 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">PlanFlow</h1>
          <p className="text-[11px] text-muted">your planning buddy</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNewChat}
            disabled={sending || messages.length === 0}
            title="Clear conversation"
            className="text-[11px] text-muted hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            new chat
          </button>
          <button
            onClick={openDashboard}
            className="text-[11px] text-muted hover:text-accent"
          >
            dashboard →
          </button>
        </div>
      </header>

      <div className="flex justify-center py-4 border-b border-border bg-surface/30">
        <Avatar state={sending ? 'talking' : 'idle'} size={144} />
      </div>

      <ChatBox
        messages={messages}
        onSend={onSend}
        sending={sending}
        emptyHint="ask what you've been up to today"
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
