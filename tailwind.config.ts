import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eefafa',
          100: '#ccf2f2',
          200: '#99e5e4',
          400: '#2ec4c0',
          500: '#22b0ac',
          600: '#1a9c98',
          700: '#137a77',
          900: '#0a4644',
        },
        navy: {
          600: '#1e3d72',
          700: '#163060',
          800: '#0f2148',
        },
        accent: {
          500: '#f59e0b',
          600: '#d97706',
        },
      },
    },
  },
  plugins: [],
}
export default config
