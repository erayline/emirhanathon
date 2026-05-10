import { create } from 'zustand';
import type { ChatMessage } from '../types';
import { chatStore } from '../lib/storage';
import { CHAT_HISTORY_LIMIT } from '../constants';

type ChatState = {
  messages: ChatMessage[];
  loaded: boolean;
  sending: boolean;
  load: () => Promise<void>;
  appendUser: (text: string) => Promise<ChatMessage>;
  appendAssistantPlaceholder: () => ChatMessage;
  /** Append text into the trailing assistant placeholder (during stream). */
  appendAssistantChunk: (id: string, chunk: string) => void;
  /** Persist the trailing assistant message to storage. */
  finalizeAssistant: (id: string) => Promise<void>;
  setSending: (b: boolean) => void;
  clear: () => Promise<void>;
};

export const useChat = create<ChatState>((set, get) => ({
  messages: [],
  loaded: false,
  sending: false,
  load: async () => {
    if (get().loaded) return;
    const list = await chatStore.list();
    set({ messages: list, loaded: true });
  },
  appendUser: async (text) => {
    const msg: ChatMessage = {
      id: `m_${Date.now()}_u`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    set({ messages: [...get().messages, msg] });
    await chatStore.append(msg, CHAT_HISTORY_LIMIT);
    return msg;
  },
  appendAssistantPlaceholder: () => {
    const msg: ChatMessage = {
      id: `m_${Date.now()}_a`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    set({ messages: [...get().messages, msg] });
    return msg;
  },
  appendAssistantChunk: (id, chunk) => {
    set({
      messages: get().messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m,
      ),
    });
  },
  finalizeAssistant: async (id) => {
    const msg = get().messages.find((m) => m.id === id);
    if (!msg) return;
    await chatStore.append(msg, CHAT_HISTORY_LIMIT);
  },
  setSending: (b) => set({ sending: b }),
  clear: async () => {
    await chatStore.clear();
    set({ messages: [] });
  },
}));
