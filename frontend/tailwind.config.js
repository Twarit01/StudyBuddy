/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0eeff',
          100: '#e4e0ff',
          200: '#cdc5ff',
          300: '#b09bff',
          400: '#9270ff',
          500: '#7c6af7',
          600: '#6b5ce7',
          700: '#5a4bd1',
          800: '#4a3dab',
          900: '#3d3389',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}