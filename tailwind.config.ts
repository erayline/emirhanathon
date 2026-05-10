import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{ts,tsx,html}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0F0F12',
        surface: '#1A1A1F',
        border: '#2A2A30',
        text: '#E8E8EC',
        muted: '#8A8A95',
        accent: '#FF4D6D',
        accentDeep: '#8A0E2A',
        accentLight: '#FFD1DC',
        fixed: '#3B82F6',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        pixel: ['"VT323"', 'monospace'],
      },
      keyframes: {
        dropIn: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '70%': { transform: 'translateY(20px)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        dropIn: 'dropIn 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
    },
  },
  plugins: [],
} satisfies Config;
