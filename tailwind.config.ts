import type { Config } from 'tailwindcss'

/**
 * Celestial Pearl — bright luxury light theme.
 * Tailwind v4 reads design tokens from app/globals.css @theme;
 * this file documents the palette and supports tooling that expects a config.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAF9F6',
        card: '#FFFFFF',
        primary: {
          DEFAULT: '#E8C8B8',
          dim: '#F5EBE4',
          dark: '#D4A898',
        },
        secondary: {
          DEFAULT: '#A5C4D0',
          dim: '#C5D9E3',
          dark: '#7FA8BA',
        },
        gold: {
          DEFAULT: '#C9A96E',
          dim: '#E5D4B0',
          dark: '#A88B4A',
        },
        'on-surface': '#1A2A44',
        'on-surface-variant': '#555555',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F7F5F1',
        'surface-container': '#F0ECE6',
        'surface-container-high': '#E8E2DA',
        'outline-variant': '#DDD4CC',
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        display: ['var(--font-cinzel)', 'var(--font-playfair)', 'Georgia', 'serif'],
      },
    },
  },
}

export default config