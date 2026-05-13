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
          accent: '#A85A32',      // Alias for brown — used by some components
          cream: '#FFF8E7',       // Warm cream background
          dark: '#2D2014',        // Dark brown for text
          light: '#FFFDF8',       // Off-white
          cocoa: '#5C3A1E',       // Deeper brown for gradient stops
          peach: '#FFD9A8',       // Soft warm highlight for mesh
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'mesh-drift': 'meshDrift 30s ease-in-out infinite alternate',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        meshDrift: {
          '0%':   { transform: 'translate3d(0,0,0) scale(1)' },
          '50%':  { transform: 'translate3d(2%,-3%,0) scale(1.05)' },
          '100%': { transform: 'translate3d(-2%,2%,0) scale(1.02)' },
        },
      },
    },
  },
  plugins: [],
}
