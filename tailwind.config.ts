import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1668',
          50:  '#E8EAFF',
          100: '#C5CAFF',
          200: '#8B96FF',
          300: '#5062FF',
          400: '#1A30FF',
          500: '#0B1668',
          600: '#091254',
          700: '#070E40',
          800: '#050A2C',
          900: '#030618',
        },
        lime: {
          DEFAULT: '#C9E000',
          50:  '#F7FBCC',
          100: '#EDF799',
          200: '#DFF066',
          300: '#D1E833',
          400: '#C9E000',
          500: '#A0B300',
          600: '#788600',
          700: '#505900',
          800: '#282C00',
          900: '#0A0B00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
