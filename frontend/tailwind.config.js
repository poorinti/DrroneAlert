/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Noto Sans Thai', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'] },
      colors: { primary: '#0878ff', ink: '#172033', muted: '#718096' },
      boxShadow: { glass: '0 16px 44px rgba(37, 53, 74, .13)' }
    }
  },
  plugins: []
};
