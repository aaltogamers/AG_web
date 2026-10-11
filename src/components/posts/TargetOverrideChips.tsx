import { useState, type ReactNode } from 'react'
import moment, { type Moment } from 'moment'
import { FaAlignLeft, FaPen, FaRegClock } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import Dialog from '../Dialog'
import MarkdownEditor from './MarkdownEditor'
import PostTimePicker from './PostTimePicker'
import type { Channel, PlaceholderOptions } from '../../utils/social/types'
import type { TargetDraft } from './postDraft'

type Props = {
  target: TargetDraft
  channel: Channel
  onChange: (changes: Partial<TargetDraft>) => void
  // The post's own send time and text, the starting point of an override
  postSendAt: string
  postBodyMd: string
  sendOnApproval: boolean
  eventStart: Moment | null
  placeholders?: PlaceholderOptions | null
}

type Editing = 'time' | 'text' | 'footer' | null

const Chip = ({
  Icon,
  label,
  active,
  onClick,
}: {
  Icon: IconType
  label: string
  active: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${
      active ? 'border-red bg-red text-white' : 'border-lightgray text-lightgray hover:border-red'
    }`}
  >
    <Icon className="shrink-0" />
    {label}
  </button>
)

// Edits an override in a dialog: Save keeps it, Remove goes back to the post's value
const OverrideDialog = ({
  title,
  active,
  onSave,
  onRemove,
  onClose,
  children,
}: {
  title: string
  active: boolean
  onSave: () => void
  onRemove: () => void
  onClose: () => void
  children: ReactNode
}) => (
  <Dialog title={title} onClose={onClose} maxWidthClass="max-w-2xl" fullScreenOnMobile>
    {children}
    <div className="flex flex-wrap gap-3 text-base">
      <button type="button" className="borderbutton" onClick={onSave}>
        Save
      </button>
      {active && (
        <button type="button" className="borderbutton" onClick={onRemove}>
          Remove
        </button>
      )}
      <button type="button" className="link" onClick={onClose}>
        Cancel
      </button>
    </div>
  </Dialog>
)

// The rarely used per-channel overrides (send time, text, footer) as small chips
const TargetOverrideChips = ({
  target,
  channel,
  onChange,
  postSendAt,
  postBodyMd,
  sendOnApproval,
  eventStart,
  placeholders,
}: Props) => {
  const [editing, setEditing] = useState<Editing>(null)
  const [value, setValue] = useState('')

  const open = (which: Exclude<Editing, null>) => {
    setValue(
      which === 'time'
        ? target.sendAt || postSendAt
        : which === 'text'
          ? target.bodyOverrideMd || postBodyMd
          : target.footerOverride
            ? target.footerOverrideMd
            : channel.defaultFooterMd
    )
    setEditing(which)
  }
  const close = () => setEditing(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip
        Icon={FaRegClock}
        label={
          target.ownTime && target.sendAt
            ? `Custom send time ${moment(target.sendAt).format('ddd D.M. HH:mm')}`
            : 'Not using custom send time'
        }
        active={target.ownTime}
        onClick={() => open('time')}
      />
      <Chip
        Icon={FaPen}
        label={target.detached ? 'Custom text' : 'Not using custom text'}
        active={target.detached}
        onClick={() => open('text')}
      />
      <Chip
        Icon={FaAlignLeft}
        label={
          target.footerOverride
            ? target.footerOverrideMd.trim()
              ? 'Custom footer'
              : 'Custom footer: none'
            : 'Not using custom footer'
        }
        active={target.footerOverride}
        onClick={() => open('footer')}
      />

      {editing === 'time' && (
        <OverrideDialog
          title={`Send time for ${channel.name}`}
          active={target.ownTime}
          onSave={() => {
            onChange({ ownTime: true, sendAt: value })
            close()
          }}
          onRemove={() => {
            onChange({ ownTime: false })
            close()
          }}
          onClose={close}
        >
          <PostTimePicker
            value={value}
            onChange={setValue}
            eventStart={eventStart}
            extraPresets={
              postSendAt && !sendOnApproval
                ? [-60, 60].map((minutes) => ({
                    label: `1 hour ${minutes < 0 ? 'before' : 'after'} the post's time`,
                    icon: <FaRegClock />,
                    time: moment(postSendAt).add(minutes, 'minutes'),
                  }))
                : []
            }
          />
        </OverrideDialog>
      )}
      {editing === 'text' && (
        <OverrideDialog
          title={`Custom text for ${channel.name}`}
          active={target.detached}
          onSave={() => {
            onChange({ detached: true, bodyOverrideMd: value })
            close()
          }}
          onRemove={() => {
            onChange({ detached: false })
            close()
          }}
          onClose={close}
        >
          <MarkdownEditor value={value} onChange={setValue} rows={10} placeholders={placeholders} />
        </OverrideDialog>
      )}
      {editing === 'footer' && (
        <OverrideDialog
          title={`Footer for ${channel.name}`}
          active={target.footerOverride}
          onSave={() => {
            onChange({ footerOverride: true, footerOverrideMd: value })
            close()
          }}
          onRemove={() => {
            onChange({ footerOverride: false })
            close()
          }}
          onClose={close}
        >
          {channel.defaultFooterMd && (
            <div className="text-sm text-lightgray">Default: {channel.defaultFooterMd}</div>
          )}
          <MarkdownEditor
            value={value}
            onChange={setValue}
            rows={3}
            placeholder="Empty for no footer"
            placeholders={placeholders}
          />
        </OverrideDialog>
      )}
    </div>
  )
}

export default TargetOverrideChips
