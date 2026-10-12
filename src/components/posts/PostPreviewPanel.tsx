import { useState } from 'react'
import moment from 'moment'
import { PLATFORM_LABELS, type Platform, type PostPreview } from '../../utils/social/types'
import { BlockMarkdown } from '../../utils/markdownLinks'
import { showDiscordRoles } from '../../utils/social/render'
import TelegramHtml from './TelegramHtml'
import WebsitePagePreview from './WebsitePagePreview'

const formatTime = (iso: string | null) => (iso ? moment(iso).format('ddd D.M.YYYY HH:mm') : 'no time')

type Props = {
  preview: PostPreview | null
  loading?: boolean
  // Platforms with a test channel in the settings
  testPlatforms?: Platform[]
  // Sends the channel's text to its platform's test channel
  onTestSend?: (channelId: string) => Promise<void>
}

// A tab per channel with its text exactly as it will be sent, and the website change
const PostPreviewPanel = ({ preview, loading, testPlatforms = [], onTestSend }: Props) => {
  const [tab, setTab] = useState(0)
  const [testSending, setTestSending] = useState(false)
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
            {text.onApproval ? 'when approved' : formatTime(text.sendAt)} ·{' '}
            <span className={text.length > text.limit ? 'text-red' : ''}>
              {text.length} / {text.limit} characters
            </span>
            {text.platform !== 'telegram' && ' · formatting is approximate'}
            {onTestSend && testPlatforms.includes(text.platform) && (
              <>
                {' · '}
                <button
                  type="button"
                  className="link"
                  disabled={testSending}
                  onClick={async () => {
                    setTestSending(true)
                    await onTestSend(text.channelId).finally(() => setTestSending(false))
                  }}
                >
                  {testSending ? 'Posting…' : 'Post on test channel'}
                </button>
              </>
            )}
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
              <BlockMarkdown text={showDiscordRoles(text.text, text.roleNames)} keepLineBreaks />
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
            {website.eventSlug ? `/events/${website.eventSlug}` : ''} · {website.timing === 'on_approval' ? 'when approved' : formatTime(website.runAt)}
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
          {website.kind === 'update_event' && website.diff.length > 0 && (
            <div className="text-sm text-lightgray">Changes: {website.diff.map((d) => d.field).join(', ')}</div>
          )}
          {website.page?.event.visibleOnEventsPage === false && (
            <div className="text-sm text-lightgray">Not shown on the events page</div>
          )}
          {website.page?.event.visibleOnCalendar === false && (
            <div className="text-sm text-lightgray">Not shown on the calendar</div>
          )}
          {website.page && <WebsitePagePreview page={website.page} />}
        </div>
      )}
    </div>
  )
}

export default PostPreviewPanel
