import { ReactNode, useMemo, useState } from 'react'
import { QRCodeErrorCorrectionLevel } from 'qrcode'
import slug from 'slug'
import { CornerStyle, DotStyle, qrSvg, svgToPng } from '../utils/qrSvg'
import type { TaggedLink } from '../utils/taggedLinks'

type Props = { link: TaggedLink }

const PNG_SIZE = 4096

const ERROR_LEVELS: { value: QRCodeErrorCorrectionLevel; label: string }[] = [
  { value: 'L', label: 'Low (7%)' },
  { value: 'M', label: 'Medium (15%)' },
  { value: 'Q', label: 'Quartile (25%)' },
  { value: 'H', label: 'High (30%)' },
]

const DOT_STYLES: { value: DotStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
]

const CORNER_STYLES: { value: CornerStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
]

export const inputClass = 'p-2 rounded-md bg-white text-black border border-gray-300'

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className="text-sm text-lightgray">{label}</span>
    {children}
  </label>
)

const download = (href: string, fileName: string) => {
  const a = document.createElement('a')
  a.href = href
  a.download = fileName
  a.click()
}

const Choice = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) => (
  <div className="flex gap-2">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={`px-3 py-1.5 rounded-md border text-sm ${
          value === o.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'
        }`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
)

// QR code maker for a saved tagged link
const QRCodeGenerator = ({ link }: Props) => {
  const [errorLevel, setErrorLevel] = useState<QRCodeErrorCorrectionLevel>('M')
  const [dotStyle, setDotStyle] = useState<DotStyle>('square')
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>('square')
  const [color, setColor] = useState('#000000')
  const [background, setBackground] = useState('#ffffff')
  const [transparent, setTransparent] = useState(false)

  const url = link.taggedUrl

  const { svg, error } = useMemo(() => {
    try {
      const svg = qrSvg(url, {
        errorCorrectionLevel: errorLevel,
        dotStyle,
        cornerStyle,
        color,
        background: transparent ? null : background,
      })
      return { svg, error: '' }
    } catch (e) {
      return { svg: '', error: (e as Error).message }
    }
  }, [url, errorLevel, dotStyle, cornerStyle, color, background, transparent])

  const fileName = `qr-${slug(link.name)}`

  const downloadPng = async () => download(await svgToPng(svg, PNG_SIZE), `${fileName}.png`)

  const downloadSvg = () => {
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    download(blobUrl, `${fileName}.svg`)
    URL.revokeObjectURL(blobUrl)
  }

  return (
    <div className="flex flex-col gap-6">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all underline text-sm"
      >
        {url}
      </a>
      <div className="flex flex-wrap gap-10">
        <div className="flex flex-col gap-5 flex-1 min-w-72">
          <Field label="Dots">
            <Choice options={DOT_STYLES} value={dotStyle} onChange={setDotStyle} />
          </Field>
          <Field label="Corners">
            <Choice options={CORNER_STYLES} value={cornerStyle} onChange={setCornerStyle} />
          </Field>
          <div className="flex flex-wrap gap-6 items-center">
            <label className="flex gap-2 items-center">
              Color
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
            <label className="flex gap-2 items-center">
              Background
              <input
                type="color"
                value={background}
                disabled={transparent}
                onChange={(e) => setBackground(e.target.value)}
              />
            </label>
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              Transparent
            </label>
          </div>
          <Field label="Error correction (higher survives more damage or covering, but is denser)">
            <select
              className={inputClass}
              value={errorLevel}
              onChange={(e) => setErrorLevel(e.target.value as QRCodeErrorCorrectionLevel)}
            >
              {ERROR_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-col gap-4 items-center">
          <div
            className="w-72 h-72 flex items-center justify-center rounded-md border border-gray-300 overflow-hidden"
            style={{
              background: transparent
                ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 0 / 20px 20px'
                : undefined,
            }}
          >
            {svg ? (
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                alt={`QR code for ${url}`}
                className="w-full h-full"
              />
            ) : (
              <span className="text-lightgray">{error}</span>
            )}
          </div>
          <div className="flex gap-4">
            <button type="button" className="mainbutton" disabled={!svg} onClick={downloadPng}>
              Download PNG
            </button>
            <button type="button" className="borderbutton" disabled={!svg} onClick={downloadSvg}>
              Download SVG
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QRCodeGenerator
