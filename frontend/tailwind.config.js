/** @type {import('tailwindcss').Config} */
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#ffffff',
          dark: '#0a1929'
        },
        card: {
          DEFAULT: '#f8fafc',
          dark: '#132f4c'
        },
        primary: {
          DEFAULT: '#00FFCC',
          dark: '#00FFCC'
        },
        secondary: {
          DEFAULT: '#64748b',
          dark: '#94a3b8'
        },
        text: {
          DEFAULT: '#0f172a',
          dark: '#f8fafc'
        },
        'muted-foreground': {
          DEFAULT: '#64748b',
          dark: '#94a3b8'
        },
        destructive: {
          DEFAULT: '#ef4444',
          dark: '#f87171'
        }
      }
    },
  },
  plugins: [
    animate
  ],
}