'use client'

/* eslint-disable @next/next/no-img-element */

import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'

const Roulette = () => {
  const patchNames = [
    'Among Us.png',
    'Mario.png',
    'Minecraft.png',
    'Pokemon.png',
    'Teemo.png',
    'Zelda.png',
  ]
  const [patch, setPatch] = useState<string | null>(patchNames[0])
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [speed, setSpeed] = useState(0)
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

    const draw = (ctx: CanvasRenderingContext2D) => {
      const { width, height } = ctx.canvas
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = 'red'
      const imageElements = patchNames
        .map((name) => document.getElementById(name) as HTMLImageElement | null)
        .filter((element) => element !== null)

      const scaleRatio = 8

      const imageWidth = 1982 / scaleRatio
      const imageHeight = 3259 / scaleRatio

      const imageCount = imageElements.length
      const gapWidth = 120
      const totalWidth = (imageWidth + gapWidth) * imageCount

      imageElements.forEach((imageElement, index) => {
        const x = ((index * (imageWidth + gapWidth) + frameCount.current) % totalWidth) - imageWidth
        ctx.drawImage(imageElement, x, 0, imageWidth, imageHeight)
      })
    }

    const render = () => {
      frameCount.current += speed
      draw(context)
      animationFrameId = window.requestAnimationFrame(render)
    }
    render()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [speed])

  return (
    <div>
      <Head>
        <title>Roulette - Aalto Gamers</title>
      </Head>
      <main className="relative">
        <canvas ref={canvasRef} width={windowSize.width} height={windowSize.height} />
        {patchNames.map((name) => (
          <img src={`/images/patches/${name}`} alt={name} key={name} className="hidden" id={name} />
        ))}
        <div className="absolute bottom-40 w-full flex justify-center">
          <input
            type="range"
            min="0"
            max="10"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </div>
      </main>
    </div>
  )
}

export default Roulette
