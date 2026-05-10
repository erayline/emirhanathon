import { useEffect, useState } from 'react';
import type { CalendarEvent, Day, EventType } from '../types';
import { DAY_NAMES_FULL } from '../constants';
import {
  hhmmToMinutes,
  minutesToHHMM,
  newEventId,
  todayDayIndex,
  validateEvent,
} from '../lib/calendar';

type Mode = 'create' | 'edit';

type Props = {
  open: boolean;
  mode: Mode;
  initial?: CalendarEvent | null;
  /** Used in create mode to prefill day/start/end (e.g. from a slot click). */
  defaults?: Partial<CalendarEvent>;
  onClose: () => void;
  onSave: (e: CalendarEvent) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

type Draft = {
  title: string;
  day: Day;
  start: string; // HH:MM
  end: string;
  recurring: boolean;
  type: EventType;
  completed: boolean;
  notes: string;
};

function emptyDraft(defaults?: Partial<CalendarEvent>): Draft {
  return {
    title: defaults?.title ?? '',
    day: defaults?.day ?? todayDayIndex(),
    start:
      typeof defaults?.startMinutes === 'number'
        ? minutesToHHMM(defaults.startMinutes)
        : '09:00',
    end:
      typeof defaults?.endMinutes === 'number'
        ? minutesToHHMM(defaults.endMinutes)
        : '10:00',
    recurring: defaults?.recurring ?? false,
    type: defaults?.type ?? 'task',
    completed: false,
    notes: defaults?.notes ?? '',
  };
}

function fromEvent(e: CalendarEvent): Draft {
  return {
    title: e.title,
    day: e.day,
    start: minutesToHHMM(e.startMinutes),
    end: minutesToHHMM(e.endMinutes),
    recurring: e.recurring,
    type: e.type,
    completed: e.completed,
    notes: e.notes ?? '',
  };
}

export function EventModal({
  open,
  mode,
  initial,
  defaults,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ? fromEvent(initial) : emptyDraft(defaults));
    setError(null);
  }, [open, initial, defaults]);

  if (!open) return null;

  const submit = async () => {
    const startMinutes = hhmmToMinutes(draft.start);
    const endMinutes = hhmmToMinutes(draft.end);
    const validation = validateEvent({
      title: draft.title,
      day: draft.day,
      startMinutes,
      endMinutes,
    });
    if (validation) {
      setError(validation);
      return;
    }
    const event: CalendarEvent =
      mode === 'edit' && initial
        ? {
            ...initial,
            title: draft.title.trim(),
            day: draft.day,
            startMinutes,
            endMinutes,
            recurring: draft.recurring,
            type: draft.type,
            completed: draft.completed,
            notes: draft.notes.trim() || undefined,
          }
        : {
            id: newEventId(),
            title: draft.title.trim(),
            day: draft.day,
            startMinutes,
            endMinutes,
            recurring: draft.recurring,
            type: draft.type,
            completed: false,
            notes: draft.notes.trim() || undefined,
            createdAt: Date.now(),
          };
    await onSave(event);
    onClose();
  };

  const remove = async () => {
    if (!initial || !onDelete) return;
    if (!confirm(`Delete "${initial.title}"?`)) return;
    await onDelete(initial.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {mode === 'edit' ? 'Edit event' : 'New event'}
          </h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Field label="Title">
            <input
              type="text"
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="input"
              placeholder="e.g. Read literature paper"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Day">
              <select
                value={draft.day}
                onChange={(e) =>
                  setDraft({ ...draft, day: Number(e.target.value) as Day })
                }
                className="input"
              >
                {Object.entries(DAY_NAMES_FULL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start">
              <input
                type="time"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft({ ...draft, type: e.target.value as EventType })
                }
                className="input"
              >
                <option value="task">Task (triggers nudges)</option>
                <option value="fixed">Fixed (class/meeting)</option>
              </select>
            </Field>
            <Field label="Recurring">
              <label className="flex items-center gap-2 h-9 px-2">
                <input
                  type="checkbox"
                  checked={draft.recurring}
                  onChange={(e) =>
                    setDraft({ ...draft, recurring: e.target.checked })
                  }
                />
                <span className="text-muted text-xs">Repeat weekly</span>
              </label>
            </Field>
          </div>
          {mode === 'edit' && (
            <Field label="Status">
              <label className="flex items-center gap-2 h-9 px-2">
                <input
                  type="checkbox"
                  checked={draft.completed}
                  onChange={(e) =>
                    setDraft({ ...draft, completed: e.target.checked })
                  }
                />
                <span className="text-muted text-xs">Mark completed</span>
              </label>
            </Field>
          )}
          <Field label="Notes (optional)">
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="input"
              rows={2}
            />
          </Field>
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
              {error}
            </p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          {mode === 'edit' ? (
            <button
              onClick={remove}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={submit} className="btn btn-primary">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-muted mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
