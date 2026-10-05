import { FaCheckCircle, FaExternalLinkAlt, FaTelegramPlane } from 'react-icons/fa'

// The sign-up form's message and link for participants who got a place
export type ConfirmedInfo = { message?: string; link?: string }

const isTelegramLink = (link: string) => /^https?:\/\/(www\.)?(t\.me|telegram\.me)\//i.test(link)

type Props = {
  info: ConfirmedInfo
  className?: string
}

/** Shown to participants who got a place, e.g. with a link to the event's Telegram group */
const ConfirmedMessage = ({ info: { message, link }, className = '' }: Props) => (
  <div
    className={`flex flex-col gap-3 bg-red/15 border-2 border-red rounded px-5 py-4 text-left ${className}`}
  >
    <div className="flex items-center gap-2 uppercase tracking-widest text-sm font-bold text-white">
      <FaCheckCircle className="shrink-0 text-red" size={18} />
      You have a place
    </div>
    {message && <p className="text-xl text-white whitespace-pre-line break-words">{message}</p>}
    {link && (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mainbutton !max-w-none w-full !text-lg !py-3 !px-4 flex items-center justify-center gap-3 font-bold"
      >
        {isTelegramLink(link) ? (
          <>
            <FaTelegramPlane size={20} />
            Open in Telegram
          </>
        ) : (
          <>
            <FaExternalLinkAlt size={16} />
            Open link
          </>
        )}
      </a>
    )}
  </div>
)

export default ConfirmedMessage
