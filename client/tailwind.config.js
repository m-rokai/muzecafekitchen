/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Muze Café brand colors
        muze: {
          gold: '#F5B82E',        // Primary yellow/gold from logo
          brown: '#A85A32',       // Terracotta brown from "café"
          cream: '#FFF8E7',       // Warm cream background
          dark: '#2D2014',        // Dark brown for text
          light: '#FFFDF8',       // Off-white
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
