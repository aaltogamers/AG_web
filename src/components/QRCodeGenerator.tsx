import { ReactNode, useMemo, useState } from 'react'
import { QRCodeErrorCorrectionLevel } from 'qrcode'
import { CornerStyle, DotStyle, qrSvg, svgToPng } from '../utils/qrSvg'

export type QRTarget = { name: string; fileName: string; url: string }
export type QRTargetGroup = { label: string; targets: QRTarget[] }

type Props = { groups: QRTargetGroup[] }

const CUSTOM = 'custom'
const PNG_SIZE = 4096
const REDIRECTS_CMS_URL = '/cms#/collections/links/entries/links'

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

const inputClass = 'p-2 rounded-md bg-white text-black border border-gray-300'

const withRef = (url: string, ref: string) => {
  if (!ref) return url
  try {
    const u = new URL(url)
    u.searchParams.set('ref', ref)
    return u.toString()
  } catch {
    return url
  }
}

const download = (href: string, fileName: string) => {
  const a = document.createElement('a')
  a.href = href
  a.download = fileName
  a.click()
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className="text-sm text-lightgray">{label}</span>
    {children}
  </label>
)

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

const QRCodeGenerator = ({ groups }: Props) => {
  const [selected, setSelected] = useState(groups.length ? '0:0' : CUSTOM)
  const [customUrl, setCustomUrl] = useState('https://aaltogamers.fi/')
  const [errorLevel, setErrorLevel] = useState<QRCodeErrorCorrectionLevel>('M')
  const [dotStyle, setDotStyle] = useState<DotStyle>('square')
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>('square')
  const [color, setColor] = useState('#000000')
  const [background, setBackground] = useState('#ffffff')
  const [transparent, setTransparent] = useState(false)
  const [ref, setRef] = useState('qr')

  const target = useMemo<QRTarget>(() => {
    if (selected === CUSTOM) return { name: 'Custom', fileName: 'custom', url: customUrl }
    const [g, t] = selected.split(':').map(Number)
    return groups[g].targets[t]
  }, [selected, customUrl, groups])

  const url = withRef(target.url, ref.trim())

  const { svg, error } = useMemo(() => {
    if (!url) return { svg: '', error: 'Enter a URL' }
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

  const fileName = `qr-${target.fileName}`

  const downloadPng = async () => download(await svgToPng(svg, PNG_SIZE), `${fileName}.png`)

  const downloadSvg = () => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    download(url, `${fileName}.svg`)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-3xl">QR codes</h2>
        <a
          href={REDIRECTS_CMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="borderbutton"
        >
          Edit redirect links
        </a>
      </div>
      <div className="flex flex-wrap gap-12">
        <div className="flex flex-col gap-5 flex-1 min-w-72">
          <Field label="Link">
            <select
              className={inputClass}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {groups.map((group, g) => (
                <optgroup key={group.label} label={group.label}>
                  {group.targets.map((t, i) => (
                    <option key={t.url} value={`${g}:${i}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={CUSTOM}>Custom URL</option>
            </select>
          </Field>
          {selected === CUSTOM && (
            <Field label="URL">
              <input
                className={inputClass}
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
              />
            </Field>
          )}
          <Field label="Statistics tag (see how many people arrived at link through this code)">
            <input className={inputClass} value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline text-sm"
          >
            {url}
          </a>
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
            className="w-80 h-80 flex items-center justify-center rounded-md border border-gray-300 overflow-hidden"
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
