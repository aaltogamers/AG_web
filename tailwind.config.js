/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{js,ts,jsx,tsx}', './src/components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: { blockletter: 'Blockletter', oswald: 'Oswald' },
    extend: {
      colors: {
        black: '#1C1D26',
        red: '#FE574A',
        darkGray: '#23242D',
      },
    },
  },
  plugins: [],
}
