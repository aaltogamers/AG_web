import QRCode, { QRCodeErrorCorrectionLevel } from 'qrcode'

export type DotStyle = 'square' | 'rounded' | 'dots'
export type CornerStyle = 'square' | 'rounded' | 'circle'

export type QRStyle = {
  errorCorrectionLevel: QRCodeErrorCorrectionLevel
  dotStyle: DotStyle
  cornerStyle: CornerStyle
  color: string
  background: string | null
}

const MARGIN = 2

const roundedRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}` +
  `A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}` +
  `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`

// Each corner is rounded only when both of its neighbouring sides are empty
const cell = (x: number, y: number, tl: number, tr: number, br: number, bl: number) =>
  `M${x + tl},${y}H${x + 1 - tr}A${tr},${tr} 0 0 1 ${x + 1},${y + tr}V${y + 1 - br}` +
  `A${br},${br} 0 0 1 ${x + 1 - br},${y + 1}H${x + bl}A${bl},${bl} 0 0 1 ${x},${y + 1 - bl}` +
  `V${y + tl}A${tl},${tl} 0 0 1 ${x + tl},${y}Z`

const CORNER_RADII: Record<CornerStyle, [number, number, number]> = {
  square: [0, 0, 0],
  rounded: [2, 1.5, 1],
  circle: [3.5, 2.5, 1.5],
}

export const qrSvg = (text: string, style: QRStyle) => {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: style.errorCorrectionLevel })
  const n = modules.size
  const dark = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < n && c < n && Boolean(modules.get(r, c))
  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)

  let dots = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!dark(r, c) || inFinder(r, c)) continue
      const x = c + MARGIN
      const y = r + MARGIN
      if (style.dotStyle === 'dots') {
        dots += `M${x + 0.5},${y + 0.05}a0.45,0.45 0 1 1 0,0.9a0.45,0.45 0 1 1 0,-0.9Z`
      } else if (style.dotStyle === 'rounded') {
        const up = dark(r - 1, c)
        const down = dark(r + 1, c)
        const left = dark(r, c - 1)
        const right = dark(r, c + 1)
        const k = 0.5
        dots += cell(
          x,
          y,
          up || left ? 0 : k,
          up || right ? 0 : k,
          down || right ? 0 : k,
          down || left ? 0 : k
        )
      } else {
        dots += `M${x},${y}h1v1h-1Z`
      }
    }
  }

  const [outer, hole, inner] = CORNER_RADII[style.cornerStyle]
  let corners = ''
  for (const [r, c] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ]) {
    const x = c + MARGIN
    const y = r + MARGIN
    corners += roundedRect(x, y, 7, 7, outer) + roundedRect(x + 1, y + 1, 5, 5, hole)
    corners += roundedRect(x + 2, y + 2, 3, 3, inner)
  }

  const full = n + MARGIN * 2
  const bg = style.background
    ? `<rect width="${full}" height="${full}" fill="${style.background}"/>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" width="${full * 10}" height="${full * 10}">` +
    `${bg}<path fill="${style.color}" fill-rule="evenodd" d="${corners}${dots}"/></svg>`
  )
}

export const svgToPng = (svg: string, size: number) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d')?.drawImage(img, 0, 0, size, size)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Could not render the PNG'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
