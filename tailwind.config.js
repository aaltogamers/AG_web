/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/pages/**/*.{js,ts,jsx,tsx}', './src/components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: { blockletter: 'Blockletter', oswald: 'Oswald' },
    extend: {
      colors: {
        black: '#1C1D26',
        red: '#F32929',
        darkGray: '#23242D',
        lightGray: '#AAABAD',
      },
      gridTemplateColumns: {
        input: 'minmax(500px, 0.1fr) 400px',
        event: 'minmax(15rem, 30rem) auto',
        leaderboard: '1rem minmax(10rem, 1fr) auto',
      },
    },
  },
  plugins: [],
}
