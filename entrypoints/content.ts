type IntervenePayload = {
  type: 'INTERVENE';
  taskTitle: string;
  cueText: string;
  taskEndMinutes: number;
};

type AnyMessage = { type?: string } & Record<string, unknown>;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    let overlay: ShadowOverlay | null = null;

    chrome.runtime.onMessage.addListener((msg: AnyMessage, _sender, sendResponse) => {
      if (msg?.type === 'INTERVENE') {
        if (overlay) overlay.dismiss();
        overlay = new ShadowOverlay(msg as IntervenePayload, () => {
          overlay = null;
        });
        overlay.mount();
        sendResponse?.({ ok: true });
      }
      return false;
    });
  },
});

class ShadowOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private root: HTMLDivElement;
  private timeoutId: number | null = null;
  private frameIntervalId: number | null = null;

  constructor(
    public msg: IntervenePayload,
    private onDismiss: () => void,
  ) {
    this.host = document.createElement('div');
    this.host.setAttribute('data-planflow-overlay', '1');
    // Container fills the viewport but is fully click-through.
    // Only the avatar / bubble / buttons get pointer-events: auto.
    this.host.style.cssText =
      'all: initial; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483647; pointer-events: none;';
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this.root = document.createElement('div');
    this.shadow.appendChild(this.root);
  }

  mount() {
    (document.body || document.documentElement).appendChild(this.host);
    this.render();
    this.timeoutId = window.setTimeout(() => this.dismiss(), 30_000);
  }

  private render() {
    const t1 = chrome.runtime.getURL('avatar/talk-1.png');
    const t2 = chrome.runtime.getURL('avatar/talk-2.png');

    this.root.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }

        .stage {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 24px;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          color: #E8E8EC;
          pointer-events: none;
        }

        .avatar-wrap {
          pointer-events: auto;
          position: relative;
          width: 320px;
          height: 320px;
          filter:
            drop-shadow(0 22px 30px rgba(255, 77, 109, 0.35))
            drop-shadow(0 14px 18px rgba(0, 0, 0, 0.45));
          transform: translateY(-120%);
          animation:
            dropIn 900ms cubic-bezier(0.22, 1.45, 0.55, 1) forwards,
            bob 2400ms ease-in-out 1000ms infinite;
        }

        .avatar-wrap::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -28px;
          transform: translateX(-50%);
          width: 60%;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(0,0,0,0.45), rgba(0,0,0,0) 70%);
          filter: blur(4px);
          opacity: 0.7;
        }

        img.avatar {
          width: 100%;
          height: 100%;
          image-rendering: pixelated;
          display: block;
        }

        .bubble {
          pointer-events: auto;
          margin-top: 28px;
          max-width: 520px;
          background: #1A1A1F;
          border: 3px solid #FF4D6D;
          border-radius: 16px;
          padding: 18px 22px;
          font-size: 18px;
          line-height: 1.45;
          box-shadow:
            0 18px 40px rgba(0, 0, 0, 0.55),
            0 0 0 4px rgba(255, 77, 109, 0.18);
          position: relative;
          opacity: 0;
          transform: translateY(-12px);
          animation: fadeUp 380ms ease-out 700ms forwards;
        }

        .bubble::before {
          content: "";
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 18px;
          height: 18px;
          background: #1A1A1F;
          border-left: 3px solid #FF4D6D;
          border-top: 3px solid #FF4D6D;
        }

        .task-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #FF4D6D;
          margin-bottom: 6px;
        }

        .cue {
          color: #E8E8EC;
        }

        .actions {
          pointer-events: auto;
          display: flex;
          gap: 14px;
          margin-top: 22px;
          opacity: 0;
          transform: translateY(-10px);
          animation: fadeUp 380ms ease-out 950ms forwards;
        }

        button {
          font-family: inherit;
          font-weight: 700;
          font-size: 15px;
          padding: 13px 20px;
          border: 3px solid;
          border-radius: 10px;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: transform 90ms ease, filter 120ms ease, background 120ms ease;
          min-width: 140px;
        }

        button.primary {
          background: #FF4D6D;
          border-color: #8A0E2A;
          color: white;
          box-shadow: 0 5px 0 #8A0E2A;
        }
        button.primary:hover { filter: brightness(1.08); }
        button.primary:active {
          transform: translateY(3px);
          box-shadow: 0 2px 0 #8A0E2A;
        }

        button.secondary {
          background: #1A1A1F;
          border-color: #3A3A45;
          color: #E8E8EC;
          box-shadow: 0 5px 0 #3A3A45;
        }
        button.secondary:hover { background: #2A2A30; }
        button.secondary:active {
          transform: translateY(3px);
          box-shadow: 0 2px 0 #3A3A45;
        }

        @keyframes dropIn {
          0%   { transform: translateY(-120%); opacity: 0; }
          55%  { transform: translateY(28px);  opacity: 1; }
          78%  { transform: translateY(-10px); opacity: 1; }
          100% { transform: translateY(0);     opacity: 1; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }

        @media (max-height: 760px) {
          .avatar-wrap { width: 240px; height: 240px; }
          .bubble { font-size: 16px; padding: 14px 18px; max-width: 440px; }
          button { font-size: 14px; padding: 11px 16px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .avatar-wrap, .bubble, .actions {
            animation-duration: 1ms !important;
          }
          .avatar-wrap { animation-iteration-count: 1; }
        }
      </style>

      <div class="stage" role="alertdialog" aria-live="polite">
        <div class="avatar-wrap">
          <img class="avatar" id="pf-avatar" alt="" />
        </div>
        <div class="bubble">
          <div class="task-label">${escapeHtml(this.msg.taskTitle)}</div>
          <div class="cue" id="pf-cue"></div>
        </div>
        <div class="actions">
          <button class="primary" id="pf-go">okay boss</button>
          <button class="secondary" id="pf-snooze">5 more minutes</button>
        </div>
      </div>
    `;

    const img = this.root.querySelector<HTMLImageElement>('#pf-avatar');
    if (img) img.src = t1;
    const cueEl = this.root.querySelector<HTMLElement>('#pf-cue');
    if (cueEl) cueEl.textContent = this.msg.cueText;

    let frame = 0;
    this.frameIntervalId = window.setInterval(() => {
      frame = 1 - frame;
      if (img) img.src = frame === 0 ? t1 : t2;
    }, 250);

    this.root.querySelector('#pf-go')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' }).catch(() => {});
      this.dismiss();
    });
    this.root.querySelector('#pf-snooze')?.addEventListener('click', () => {
      const parts = location.hostname.split('.');
      const domain =
        parts.length <= 2 ? location.hostname : parts.slice(-2).join('.');
      chrome.runtime
        .sendMessage({ type: 'SNOOZE_DOMAIN', domain, minutes: 5 })
        .catch(() => {});
      this.dismiss();
    });
  }

  dismiss() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.frameIntervalId !== null) {
      window.clearInterval(this.frameIntervalId);
      this.frameIntervalId = null;
    }
    this.host.remove();
    this.onDismiss();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}
