import { useEffect, useState } from 'react';

export type AvatarState = 'idle' | 'talking';

const FRAMES: Record<AvatarState, string[]> = {
  idle: ['avatar/idle-1.png', 'avatar/idle-2.png'],
  talking: ['avatar/talk-1.png', 'avatar/talk-2.png'],
};

const INTERVAL_MS: Record<AvatarState, number> = {
  idle: 700,
  talking: 250,
};

type Props = {
  state?: AvatarState;
  size?: number;
  className?: string;
};

function frameUrl(path: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return `/${path}`;
}

export function Avatar({ state = 'idle', size = 144, className = '' }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), INTERVAL_MS[state]);
    return () => clearInterval(id);
  }, [state]);

  const src = frameUrl(FRAMES[state][frame]);

  return (
    <img
      src={src}
      alt="PlanFlow"
      width={size}
      height={size}
      draggable={false}
      className={`pixel select-none ${className}`}
      style={{
        imageRendering: 'pixelated',
        backgroundColor: 'transparent',
      }}
      onError={(e) => {
        // If the PNG hasn't been generated yet, draw a friendly fallback
        const img = e.currentTarget;
        if (img.dataset.fallback === '1') return;
        img.dataset.fallback = '1';
        img.src =
          'data:image/svg+xml;utf8,' +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect x="8" y="8" width="16" height="16" fill="#FF4D6D"/><rect x="11" y="13" width="3" height="3" fill="#0F0F12"/><rect x="18" y="13" width="3" height="3" fill="#0F0F12"/><rect x="13" y="20" width="6" height="2" fill="#0F0F12"/></svg>`,
          );
      }}
    />
  );
}
