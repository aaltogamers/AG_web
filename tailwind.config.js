/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // fontFamily: { sans: ["Roboto"],},
    extend: {
      colors: {
        black: '#090221',
        red: '#FE574A',
      },
    },
  },
  plugins: [],
}
