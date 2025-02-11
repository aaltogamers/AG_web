'use client'

/* eslint-disable @next/next/no-img-element */

import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'

type Patch = {
  game: string
  image: string
  tarot: string
}

const patches: Patch[] = [
  {
    game: 'Among Us',
    image: 'Among Us.png',
    tarot: 'Death',
  },
  {
    game: 'Mario Kart',
    image: 'Mario.png',
    tarot: 'The Chariot',
  },
  {
    game: 'Minecraft',
    image: 'Minecraft.png',
    tarot: 'The World',
  },
  {
    game: 'Pokémon',
    image: 'Pokemon.png',
    tarot: 'The Fool',
  },
  {
    game: 'League of Legends',
    image: 'Teemo.png',
    tarot: 'The Devil',
  },
  {
    game: 'The Legend of Zelda',
    image: 'Zelda.png',
    tarot: 'High Priestess',
  },
]

const Roulette = () => {
  const [refresh, setRefresh] = useState<number | null>(null)
  const [selectedPatch, setSelectedPatch] = useState<Patch | null>(null)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const speed = useRef(0)
  const frameCount = useRef(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    let animationFrameId = 0
    if (refresh) {
      speed.current = 100 + Math.random() * 50
    }

    const draw = (ctx: CanvasRenderingContext2D) => {
      const { width, height } = ctx.canvas
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = 'red'
      const imageElements = patches
        .map(({ game }) => document.getElementById(game) as HTMLImageElement | null)
        .filter((element) => element !== null)

      const scaleRatio = 6

      const imageWidth = 1982 / scaleRatio
      const imageHeight = 3259 / scaleRatio

      const imageCount = imageElements.length
      const gapWidth = 50
      const totalWidth = (imageWidth + gapWidth) * imageCount

      const y = (height - imageHeight) / 2 - 50

      const calculateImageX = (index: number) =>
        ((index * (imageWidth + gapWidth) + frameCount.current) % totalWidth) - imageWidth

      if (speed.current < 0.1 && refresh) {
        speed.current = 0
        const center = width / 2
        let closest = { distance: Infinity, index: -1 }
        imageElements.forEach((_, index) => {
          const x = calculateImageX(index)
          const centerX = x + imageWidth / 2
          const distance = Math.abs(centerX - center)
          if (distance < closest.distance) {
            closest = { distance, index }
          }
        })
        const winner = patches[closest.index]
        setSelectedPatch(winner)
      }

      imageElements.forEach((imageElement, index) => {
        const x = calculateImageX(index)
        ctx.drawImage(imageElement, x, y, imageWidth, imageHeight)
      })

      ctx.fillStyle = '#F32929'
      ctx.fillRect(width / 2 - 2, y - 50, 4, imageHeight + 100)
    }

    const render = () => {
      frameCount.current += speed.current
      speed.current *= 0.995
      draw(context)
      animationFrameId = window.requestAnimationFrame(render)
    }
    render()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [refresh])

  const selectRandomPatch = () => {
    setRefresh(Math.random() + 1)
    setSelectedPatch(null)
  }

  return (
    <div>
      <Head>
        <title>Roulette - Aalto Gamers</title>
      </Head>
      <main className="relative">
        <canvas ref={canvasRef} width={windowSize.width} height={windowSize.height} />
        {patches.map(({ game, image }) => (
          <img
            src={`/images/patches/${image}`}
            alt={game}
            key={game}
            className="hidden"
            id={game}
          />
        ))}

        <div
          className="absolute w-full flex justify-center top-0 left-0 h-full bg-[rgba(0,0,0,0.7)] pt-4"
          style={{
            opacity: selectedPatch ? 1 : 0,
            transition: selectedPatch ? 'opacity 0.75s' : '',
          }}
        >
          <div className="flex flex-col w-90 text-center gap-2 items-center">
            <h2>{selectedPatch?.game}</h2>
            <h3>{selectedPatch?.tarot}</h3>
            <img src={`/images/patches/${selectedPatch?.image}`} alt={selectedPatch?.game} />
            <button className="mainbutton mt-8" onClick={() => selectRandomPatch()}>
              SPIN AGAIN
            </button>
          </div>
        </div>
        {!refresh && (
          <div className="absolute bottom-0 w-full flex flex-col justify-center items-center gap-6 z-100 pb-24">
            <button className="mainbutton" onClick={() => selectRandomPatch()}>
              SPIN
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default Roulette
