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

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    let frameCount = 0
    let animationFrameId = 0

    const draw = (ctx: CanvasRenderingContext2D, frameCount: number) => {
      const { width, height } = ctx.canvas
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = 'red'
      const imageElement = document.getElementById(patch || '') as HTMLImageElement | null
      if (imageElement) {
        ctx.drawImage(imageElement, (frameCount * 4) % width, 0, 1982 / 5, 3259 / 5)
      }
    }

    const render = () => {
      frameCount++
      draw(context, frameCount)
      animationFrameId = window.requestAnimationFrame(render)
    }
    render()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div>
      <Head>
        <title>Roulette - Aalto Gamers</title>
      </Head>
      <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} />
      {patchNames.map((name) => (
        <img src={`/images/patches/${name}`} alt={name} key={name} className="hidden" id={name} />
      ))}
    </div>
  )
}

export default Roulette
