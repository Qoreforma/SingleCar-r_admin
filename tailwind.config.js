/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Public Sans Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Road-surface palette: petrol asphalt, lane-marking yellow, cool paper.
        road: { DEFAULT: '#0E3B43', 600: '#14505A', 700: '#0A2D33' },
        lane: { DEFAULT: '#F4B400', soft: '#FFF3D1', ink: '#7A5600' },
        paper: '#F2F4F3',
        line: { DEFAULT: '#D9DFDD', strong: '#B9C3C0' },
        ink: { DEFAULT: '#1B2A2F', muted: '#566669', faint: '#82908F' },
        primary: { DEFAULT: '#0F5560', hover: '#0B4650', soft: '#E1EFF0' },
        ok: { DEFAULT: '#1E7B4F', soft: '#E3F3EA' },
        bad: { DEFAULT: '#B3261E', soft: '#FBE7E5' },
        info: { DEFAULT: '#1F5FA8', soft: '#E4EEF9' },
      },
      borderRadius: { panel: '10px' },
      boxShadow: { pop: '0 12px 40px -8px rgba(14,59,67,0.35)' },
      keyframes: {
        drawerIn: { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: { drawer: 'drawerIn .18s ease-out', fade: 'fadeIn .15s ease-out' },
    },
  },
  plugins: [],
};
