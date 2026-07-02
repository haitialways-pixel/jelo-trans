import type { Config } from 'tailwindcss'

/** Editorial luxury — tokens live in app/globals.css @theme */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FDFBF7',
        card: '#F5EFEB',
        primary: {
          DEFAULT: '#A3B19B',
          dim: '#C5CFC0',
          dark: '#7D8F75',
        },
        gold: {
          DEFAULT: '#D4AF37',
          dim: '#E8D9A8',
          dark: '#B8942D',
        },
        'on-surface': '#2B2625',
        'on-surface-variant': '#6B6563',
        'surface-container-low': '#F5EFEB',
        'surface-container-lowest': '#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      lineHeight: {
        relaxed: '1.6',
        loose: '1.75',
      },
    },
  },
}

export default config