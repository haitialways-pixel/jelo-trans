import type { Config } from 'tailwindcss'

/** Near-black / royal / gold — tokens also live in app/globals.css @theme */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#07080C',
        card: '#12151E',
        primary: {
          DEFAULT: '#1E4FC7',
          dim: '#3B6FE8',
          dark: '#163A96',
        },
        gold: {
          DEFAULT: '#C9A84C',
          dim: '#E0C878',
          dark: '#A88832',
        },
        'on-surface': '#F4EFE6',
        'on-surface-variant': '#B7B1A6',
        'surface-container-low': '#10131A',
        'surface-container-lowest': '#1A1F2C',
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
