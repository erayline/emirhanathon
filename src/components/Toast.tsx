import { useEffect } from 'react';

export type ToastKind = 'ok' | 'err' | 'info';

export type ToastState = {
  kind: ToastKind;
  message: string;
} | null;

type Props = {
  toast: ToastState;
  onDismiss: () => void;
  durationMs?: number;
};

export function Toast({ toast, onDismiss, durationMs = 3500 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [toast, durationMs, onDismiss]);

  if (!toast) return null;

  const palette =
    toast.kind === 'ok'
      ? 'bg-accent text-white border-accentDeep'
      : toast.kind === 'err'
        ? 'bg-red-500/90 text-white border-red-700'
        : 'bg-surface text-text border-border';

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-50 px-4 py-2 rounded border shadow-lg text-sm max-w-sm ${palette}`}
    >
      {toast.message}
    </div>
  );
}
