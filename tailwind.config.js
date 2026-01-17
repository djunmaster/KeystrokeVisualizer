/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-out': 'fadeOut var(--fade-duration, 1000ms) ease-out forwards',
      },
      keyframes: {
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
