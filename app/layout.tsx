import '../styles/globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black text-white">
      <head>
        <title>Aalto Gamers</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
