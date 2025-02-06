module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    fontFamily: { blockletter: 'Blockletter', oswald: 'Oswald' },
    extend: {
      colors: {
        black: '#1C1D26',
        red: '#F32929',
        darkgray: '#23242D',
        lightgray: '#AAABAD',
        transparentBlack: 'rgba(0,0,0,0.9)',
      },
      gridTemplateColumns: {
        input: 'minmax(500px, 0.1fr) 400px',
        event: 'minmax(15rem, 30rem) auto',
        leaderboard: '1rem 1fr 4rem',
      },
    },
  },
  plugins: [],
}
