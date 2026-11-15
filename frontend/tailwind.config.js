/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#090A0D',
          900: '#101216',
          800: '#181B21',
          700: '#232730',
        },
        mars: {
          500: '#D96B43',
          600: '#B85430',
          900: '#3D1A0E',
        }
      },
      animation: {
        'mars-spin': 'marsSpin 180s linear infinite',
        'pulse-ring': 'pulseRing 3s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        marsSpin: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
