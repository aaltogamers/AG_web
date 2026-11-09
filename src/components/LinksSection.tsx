import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import moment from 'moment'
import Dialog from './Dialog'
import QRCodeGenerator, { Field, inputClass } from './QRCodeGenerator'
import { useToast } from './Toast'
import VisitorsSparkline from './VisitorsSparkline'
import type { LinkTargetGroup } from '../utils/linkTargets'
import type { PostLinkWithStats } from '../utils/social/postLinks'
import {
  LinkStats,
  TAG_PATTERN,
  TaggedLinkStats,
  TaggedLinkWithStats,
  statsPath,
  tagFromName,
  withTag,
} from '../utils/taggedLinks'

const REDIRECTS_CMS_URL = '/cms#/collections/links/entries/links'
const CUSTOM = 'custom'

type Props = { groups: LinkTargetGroup[]; initialLinkId: string | null }

const errorMessage = async (res: Response) =>
  ((await res.json().catch(() => null)) as { error?: string } | null)?.error ??
  `Error ${res.status}`

const StatsCells = ({ stats, max }: { stats: TaggedLinkStats | null; max: number }) => {
  if (!stats) {
    return (
      <>
        <td className="p-2 text-right text-lightgray">–</td>
        <td className="p-2 text-right text-lightgray">–</td>
      </>
    )
  }
  const tooltip = (s: LinkStats) => `${s.visits} visits, ${s.pageviews} page views`
  return (
    <>
      <td className="p-2">
        <div className="flex items-end justify-end gap-3">
          <VisitorsSparkline daily={stats.daily} max={max} />
          <span className="min-w-8 text-right tabular-nums" title={tooltip(stats.last30Days)}>
            {stats.last30Days.visitors}
          </span>
        </div>
      </td>
      <td className="p-2 text-right tabular-nums" title={tooltip(stats.allTime)}>
        {stats.allTime.visitors}
      </td>
    </>
  )
}

const TableHead = ({ second, extra }: { second: string; extra?: string }) => (
  <thead>
    <tr className="text-left text-lightgray border-b border-gray-300">
      <th className="p-2 font-normal">Name</th>
      <th className="p-2 font-normal">{second}</th>
      <th className="p-2 font-normal text-right">Visitors, last 30 days</th>
      <th className="p-2 font-normal text-right">Visitors, all time</th>
      <th className="p-2 font-normal">{extra}</th>
    </tr>
  </thead>
)

const NewTaggedLinkForm = ({
  groups,
  onSave,
}: {
  groups: LinkTargetGroup[]
  onSave: (link: { name: string; url: string; tag: string }) => Promise<boolean>
}) => {
  const [selected, setSelected] = useState(groups.length ? '0:0' : CUSTOM)
  const [customUrl, setCustomUrl] = useState('https://aaltogamers.fi/')
  const [name, setName] = useState('')
  const [customName, setCustomName] = useState('')
  const [addTag, setAddTag] = useState(true)
  const [saving, setSaving] = useState(false)

  const isCustom = selected === CUSTOM
  const tagged = !isCustom || addTag

  const target = useMemo(() => {
    if (selected === CUSTOM) return { name: customName.trim(), url: customUrl }
    const [g, t] = selected.split(':').map(Number)
    return groups[g].targets[t]
  }, [selected, customUrl, customName, groups])

  const tag = tagged ? tagFromName(name) : ''
  const fullName = [target.name, tagged ? name.trim() : ''].filter(Boolean).join(' – ')
  const canSave = !!target.url && !!fullName && (!tagged || TAG_PATTERN.test(tag)) && !saving

  const save = async () => {
    setSaving(true)
    if (await onSave({ name: fullName, url: target.url, tag })) {
      setName('')
      setCustomName('')
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-4 p-4 rounded-md border border-gray-300 bg-darkgray">
      <h3 className="text-2xl">New tagged link</h3>
      <p className="text-sm text-lightgray">
        A tagged link takes people to the same place as the normal link, but lets you see how many
        people came through it. Make a separate one for each poster, flyer or post, e.g. “Otaniemi
        events”, and use its QR code or link only there.
      </p>
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
      {isCustom && (
        <>
          <Field label="URL">
            <input
              className={inputClass}
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={customName}
              placeholder="e.g. Assembly tournament page"
              onChange={(e) => setCustomName(e.target.value)}
            />
          </Field>
          <label className="flex gap-2 items-center text-sm">
            <input type="checkbox" checked={addTag} onChange={(e) => setAddTag(e.target.checked)} />
            Add a statistics tag (?ref=…). Turn off if the site doesn&apos;t allow extra parameters
            in the link.
          </label>
        </>
      )}
      {tagged && (
        <Field label="Where it's used">
          <input
            className={inputClass}
            value={name}
            placeholder="e.g. Otaniemi events"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col text-sm min-w-0">
          <span>{fullName || '\u00a0'}</span>
          <span className="break-all text-lightgray">{withTag(target.url, tag)}</span>
        </div>
        <button type="button" className="mainbutton" disabled={!canSave} onClick={save}>
          Save and make QR code
        </button>
      </div>
    </div>
  )
}

const LinksSection = ({ groups, initialLinkId }: Props) => {
  const toast = useToast()
  const router = useRouter()
  const [links, setLinks] = useState<TaggedLinkWithStats[] | null>(null)
  const [statsEnabled, setStatsEnabled] = useState(true)
  const [openId, setOpenId] = useState(initialLinkId)
  const [postLinks, setPostLinks] = useState<PostLinkWithStats[] | null>(null)

  const openLink = links?.find((l) => l.id === openId)
  const maxDaily = Math.max(
    0,
    ...[...(links ?? []), ...(postLinks ?? [])].flatMap(
      (l) => l.stats?.daily.map((d) => d.visitors) ?? []
    )
  )

  const setOpen = (id: string | null) => {
    setOpenId(id)
    void router.replace({ pathname: router.pathname, query: id ? { link: id } : {} }, undefined, {
      shallow: true,
    })
  }

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/links', { credentials: 'same-origin' })
    if (!res.ok) return toast(await errorMessage(res), { isError: true })
    const data = (await res.json()) as { links: TaggedLinkWithStats[]; statsEnabled: boolean }
    setLinks(data.links)
    setStatsEnabled(data.statsEnabled)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/links/posts', { credentials: 'same-origin' })
      if (!res.ok) return toast(await errorMessage(res), { isError: true })
      setPostLinks(((await res.json()) as { links: PostLinkWithStats[] }).links)
    })()
  }, [toast])

  const save = async (input: { name: string; url: string; tag: string }) => {
    const res = await fetch('/api/admin/links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      toast(await errorMessage(res), { isError: true })
      return false
    }
    const { link } = (await res.json()) as { link: TaggedLinkWithStats }
    setLinks((prev) => [{ ...link, stats: null }, ...(prev ?? [])])
    setOpen(link.id)
    void load()
    return true
  }

  const rename = async (link: TaggedLinkWithStats) => {
    const name = prompt('New name', link.name)?.trim()
    if (!name || name === link.name) return
    const res = await fetch(`/api/admin/links/${link.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return toast(await errorMessage(res), { isError: true })
    setLinks((prev) => prev?.map((l) => (l.id === link.id ? { ...l, name } : l)) ?? null)
  }

  const remove = async (link: TaggedLinkWithStats) => {
    if (!confirm(`Delete "${link.name}"? QR codes already made with it keep working.`)) return
    const res = await fetch(`/api/admin/links/${link.id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    if (!res.ok) return toast(await errorMessage(res), { isError: true })
    setLinks((prev) => prev?.filter((l) => l.id !== link.id) ?? null)
  }

  return (
    <div className="flex flex-col gap-10 max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-3xl">Links and QR codes</h2>
        <a
          href={REDIRECTS_CMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="borderbutton"
        >
          Edit redirect links
        </a>
      </div>
      <NewTaggedLinkForm groups={groups} onSave={save} />
      <div className="flex flex-col gap-3">
        <h3 className="text-2xl">Tagged links</h3>
        {!statsEnabled && (
          <p className="text-sm text-lightgray">Visitor stats need UMAMI_API_KEY to be set.</p>
        )}
        {links === null ? (
          <span>Loading…</span>
        ) : links.length === 0 ? (
          <span className="text-lightgray">No tagged links yet.</span>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <TableHead second="Link" />
              <tbody>
                {links.map((link) => (
                  <tr key={link.id} className="border-b border-gray-200">
                    <td className="p-2">
                      <button
                        type="button"
                        className="text-left underline"
                        onClick={() => setOpen(link.id)}
                      >
                        {link.name}
                      </button>
                    </td>
                    <td className="p-2 break-all">
                      {link.taggedUrl.replace(/^https:\/\//, '')}
                      {!link.tag ? (
                        <div className="text-lightgray">No statistics tag, so no stats</div>
                      ) : (
                        !statsPath(link.url) && (
                          <div className="text-lightgray">No stats for links outside the site</div>
                        )
                      )}
                    </td>
                    <StatsCells stats={link.stats} max={maxDaily} />
                    <td className="p-2">
                      <div className="flex gap-2 justify-end whitespace-nowrap">
                        <button
                          type="button"
                          className="borderbutton"
                          onClick={() => setOpen(link.id)}
                        >
                          QR code
                        </button>
                        <button type="button" className="borderbutton" onClick={() => rename(link)}>
                          Rename
                        </button>
                        <button
                          type="button"
                          className="borderbutton hover:!text-red"
                          onClick={() => remove(link)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-2xl">From posts</h3>
        <p className="text-sm text-lightgray">
          Links in sent posts are tagged with their channel automatically, so you can see how many
          people came from each channel.
        </p>
        {postLinks === null ? (
          <span>Loading…</span>
        ) : postLinks.length === 0 ? (
          <span className="text-lightgray">No sent posts with links yet.</span>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <TableHead second="Channel" extra="Last sent" />
              <tbody>
                {postLinks.map((link) => (
                  <tr key={`${link.url}|${link.tag}`} className="border-b border-gray-200">
                    <td className="p-2">
                      <a
                        href={link.taggedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {link.label}
                      </a>
                    </td>
                    <td className="p-2">{link.channelName}</td>
                    <StatsCells stats={link.stats} max={maxDaily} />
                    <td className="p-2 whitespace-nowrap text-lightgray">
                      {moment(link.lastSentAt).format('D MMM YYYY')}
                      {link.postCount > 1 && ` (${link.postCount} posts)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {openLink && (
        <Dialog
          title={openLink.name}
          onClose={() => setOpen(null)}
          maxWidthClass="max-w-3xl"
          fullScreenOnMobile
        >
          <QRCodeGenerator link={openLink} />
        </Dialog>
      )}
    </div>
  )
}

export default LinksSection
