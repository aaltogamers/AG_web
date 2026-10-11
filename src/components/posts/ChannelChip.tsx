import type { IconType } from 'react-icons'
import { FaDiscord, FaGlobe, FaInstagram, FaTelegramPlane } from 'react-icons/fa'
import type { Channel, Platform } from '../../utils/social/types'

// Colour and logo of each platform, in the list and the calendar
export const PLATFORM_STYLE: Record<Platform | 'website', { color: string; Icon: IconType }> = {
  telegram: { color: '#229ED9', Icon: FaTelegramPlane },
  instagram: { color: '#D62976', Icon: FaInstagram },
  discord: { color: '#5865F2', Icon: FaDiscord },
  website: { color: '#4B5563', Icon: FaGlobe },
}

type Props = { platform: Platform | 'website'; label: string; className?: string }

const ChannelChip = ({ platform, label, className = '' }: Props) => {
  const { color, Icon } = PLATFORM_STYLE[platform]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-normal text-white whitespace-nowrap ${className}`}
      style={{ backgroundColor: color }}
    >
      <Icon className="shrink-0" />
      {label}
    </span>
  )
}

// The chip of a post's channel, or "?" for a channel that no longer exists
export const TargetChip = ({ channel }: { channel: Channel | undefined }) =>
  channel ? (
    <ChannelChip platform={channel.platform} label={channel.name} />
  ) : (
    <span className="rounded-full px-2 py-0.5 text-xs border border-lightgray">?</span>
  )

export default ChannelChip
