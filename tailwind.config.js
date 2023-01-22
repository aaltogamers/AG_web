/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}', // Note the addition of the `app` directory.
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    //fontFamily: { sans: ["Roboto"],},
    extend: {
      colors: {
        black: '#000000',
        red: '#FE574A',
      },
    },
  },
  plugins: [],
}
