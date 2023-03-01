/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{js,ts,jsx,tsx}', './src/components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: { blockletter: 'Blockletter' },
    extend: {
      colors: {
        black: '#090221',
        red: '#FE574A',
        darkBlue: '#23242D',
      },
    },
  },
  plugins: [],
}
