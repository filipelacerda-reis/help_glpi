/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'etus-green': '#8DF768',
        'etus-green-dark': '#7AE55A',
        'etus-green-light': '#A5F88A',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

