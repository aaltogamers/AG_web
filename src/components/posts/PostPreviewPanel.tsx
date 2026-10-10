import { useState } from 'react'
import moment from 'moment'
import { PLATFORM_LABELS, type PostPreview } from '../../utils/social/types'
import { BlockMarkdown } from '../../utils/markdownLinks'
import TelegramHtml from './TelegramHtml'

const formatTime = (iso: string | null) => (iso ? moment(iso).format('ddd D.M.YYYY HH:mm') : 'no time')

type Props = {
  preview: PostPreview | null
  loading?: boolean
}

// A tab per channel with its text exactly as it will be sent, and the website change
const PostPreviewPanel = ({ preview, loading }: Props) => {
  const [tab, setTab] = useState(0)
  if (!preview) return <div className="text-lightgray">{loading ? 'Loading preview…' : 'No preview yet'}</div>
  const tabs = [
    ...preview.texts.map((t) => `${PLATFORM_LABELS[t.platform]}: ${t.channelName}`),
    ...(preview.website ? ['Website'] : []),
  ]
  const current = Math.min(tab, tabs.length - 1)
  const text = preview.texts[current]
  const website = current >= preview.texts.length ? preview.website : null

  return (
    <div className={`flex flex-col gap-3 ${loading ? 'opacity-70' : ''}`}>
      {preview.errors.map((e) => (
        <div key={e} className="text-red">
          ❗ {e}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {tabs.map((label, i) => {
          const errors = i < preview.texts.length ? preview.texts[i].errors : (preview.website?.errors ?? [])
          return (
            <button
              key={label}
              type="button"
              onClick={() => setTab(i)}
              className={`px-3 py-1 rounded-md border text-sm ${i === current ? 'border-red' : 'border-lightgray'}`}
            >
              {errors.length > 0 && '❗ '}
              {label}
            </button>
          )
        })}
      </div>
      {text && (
        <div className="flex flex-col gap-2">
          <div className="text-sm text-lightgray">
            {formatTime(text.sendAt)} ·{' '}
            <span className={text.length > text.limit ? 'text-red' : ''}>
              {text.length} / {text.limit} characters
            </span>
            {text.platform !== 'telegram' && ' · formatting is approximate'}
          </div>
          {text.errors.map((e) => (
            <div key={e} className="text-red text-sm">
              ❗ {e}
            </div>
          ))}
          {text.warnings.map((w) => (
            <div key={w} className="text-yellow-400 text-sm">
              ⚠️ {w}
            </div>
          ))}
          <div className="bg-darkgray p-4 rounded-md text-base">
            {text.platform === 'telegram' ? (
              <TelegramHtml html={text.text} />
            ) : text.platform === 'discord' ? (
              <BlockMarkdown text={text.text} />
            ) : (
              <div className="whitespace-pre-wrap break-words">{text.text}</div>
            )}
          </div>
        </div>
      )}
      {website && (
        <div className="flex flex-col gap-2 text-base">
          <div className="text-sm text-lightgray">
            {website.kind === 'create_event' ? 'New event' : 'Change to'}{' '}
            {website.eventSlug ? `/events/${website.eventSlug}` : ''} · {formatTime(website.runAt)}
          </div>
          {website.errors.map((e) => (
            <div key={e} className="text-red text-sm">
              ❗ {e}
            </div>
          ))}
          {website.warnings.map((w) => (
            <div key={w} className="text-yellow-400 text-sm">
              ⚠️ {w}
            </div>
          ))}
          <table className="w-full text-sm border-collapse">
            <tbody>
              {website.diff.map((d) => (
                <tr key={d.field} className="border-b border-lightgray/30 align-top">
                  <td className="py-2 pr-4 font-bold whitespace-nowrap">{d.field}</td>
                  {website.kind === 'update_event' && (
                    <td className="py-2 pr-4 whitespace-pre-wrap text-lightgray line-through">{d.from}</td>
                  )}
                  <td className="py-2 whitespace-pre-wrap">{d.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {website.forms.map((f) => (
            <div key={f.key} className="text-sm">
              📝 Sign-up form {f.label}:{' '}
              {f.isNew ? 'new' : `changed; it already has ${f.signups} sign-up(s)`}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PostPreviewPanel
