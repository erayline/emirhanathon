import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void | Promise<void>;
  sending?: boolean;
  emptyHint?: string;
};

export function ChatBox({
  messages,
  onSend,
  sending = false,
  emptyHint = 'Say hi to your buddy.',
}: Props) {
  const [value, setValue] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = async () => {
    const text = value.trim();
    if (!text || sending) return;
    setValue('');
    await onSend(text);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">{emptyHint}</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-surface text-text border border-border rounded-bl-sm'
                }`}
              >
                {m.content}
                {m.role === 'assistant' && m.content === '' && sending ? (
                  <span className="text-muted">…</span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border p-2 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="ask your buddy…"
          disabled={sending}
          className="input flex-1"
        />
        <button
          onClick={submit}
          disabled={sending || !value.trim()}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
