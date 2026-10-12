import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import moment from 'moment'
import { useToast } from '../Toast'
import {
  connectBot,
  createChannel,
  deleteChannel,
  fetchBotInfo,
  fetchDiscordChannels,
  fetchInstagramAccount,
  fetchSettings,
  renewInstagramToken,
  saveSettings,
  testDiscordChannel,
  updateChannel,
  type BotInfo,
  type ChannelInput,
  type DiscordChannelOption,
  type InstagramAccount,
  type SettingsResponse,
} from '../../utils/social/postsClient'
import { PLATFORMS, PLATFORM_LABELS, type Channel, type Platform } from '../../utils/social/types'
import MarkdownEditor from './MarkdownEditor'

const inputClass = 'p-2 rounded-md bg-white text-black'

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border border-lightgray/40 rounded-md p-4 flex flex-col gap-3 text-base">
    <h3 className="text-xl font-normal">{title}</h3>
    {children}
  </section>
)

const Status = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <div className={ok ? 'text-green-400' : 'text-yellow-400'}>
    {ok ? '✅' : '⚠️'} {children}
  </div>
)

type Run = (work: () => Promise<unknown>, done?: string) => Promise<void>

const TelegramCard = ({ data, run }: { data: SettingsResponse; run: Run }) => {
  const [telegram, setTelegram] = useState(data.settings.telegram)
  const [bot, setBot] = useState<BotInfo | null>(null)
  const [newApprover, setNewApprover] = useState('')
  useEffect(() => setTelegram(data.settings.telegram), [data.settings.telegram])
  useEffect(() => {
    if (data.configured.telegram) fetchBotInfo().then((r) => setBot(r.bot)).catch(() => undefined)
  }, [data.configured.telegram])

  const addApprover = (id: string) => {
    const user = data.tgUsers.find((u) => u.id === id)
    if (!/^\d+$/.test(id) || telegram.approvers.some((a) => a.id === id)) return
    setTelegram({ ...telegram, approvers: [...telegram.approvers, { id, name: user?.name ?? '' }] })
    setNewApprover('')
  }
  const webhookOk = !!bot?.webhookUrl.endsWith('/api/telegram/posts-webhook') && !bot.webhookError

  return (
    <Card title="Telegram">
      {!data.configured.telegram ? (
        <Status ok={false}>TELEGRAM_POSTS_BOT_TOKEN is not set on the server</Status>
      ) : (
        <>
          <Status ok={webhookOk}>
            {bot ? `@${bot.username}` : 'Posts bot'}:{' '}
            {webhookOk ? 'webhook set' : bot?.webhookError ? `webhook error: ${bot.webhookError}` : 'not connected'}
          </Status>
          {bot?.webhookUrl && (
            <div className="text-sm text-lightgray">
              Webhook: {bot.webhookUrl}
              {bot.pendingUpdates > 0 && ` · ${bot.pendingUpdates} update(s) waiting`}
              {bot.lastError &&
                !bot.webhookError &&
                ` · last error ${moment(bot.lastError.at).format('D.M. HH:mm')}: ${bot.lastError.message}`}
            </div>
          )}
          {!data.configured.telegramWebhookSecret && (
            <Status ok={false}>TELEGRAM_POSTS_WEBHOOK_SECRET is not set on the server</Status>
          )}
          <button
            type="button"
            className="borderbutton self-start"
            onClick={() => run(async () => setBot((await connectBot()).bot), 'Bot connected.')}
          >
            Connect bot
          </button>
        </>
      )}

      <h4 className="text-lg mt-2">Review chat</h4>
      <div className="text-sm text-lightgray">
        Every post is sent here for review. Send <code>/review_here</code> in the topic as an approver, or
        pick or enter it here.
      </div>
      <select
        className={inputClass}
        value=""
        onChange={(e) => {
          const chat = data.knownChats.find((c) => `${c.chatId}/${c.threadId}` === e.target.value)
          if (chat) setTelegram({ ...telegram, reviewChatId: chat.chatId, reviewThreadId: chat.threadId })
        }}
      >
        <option value="">Pick a chat the bot knows…</option>
        {data.knownChats.map((c) => (
          <option key={`${c.chatId}/${c.threadId}`} value={`${c.chatId}/${c.threadId}`}>
            {c.title} ({c.chatId}
            {c.threadId && `, topic ${c.threadId}`})
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <input
          className={inputClass}
          value={telegram.reviewChatId}
          onChange={(e) => setTelegram({ ...telegram, reviewChatId: e.target.value })}
          placeholder="Chat id, e.g. -1001234567890"
        />
        <input
          className={inputClass}
          value={telegram.reviewThreadId}
          onChange={(e) => setTelegram({ ...telegram, reviewThreadId: e.target.value })}
          placeholder="Topic id (optional)"
        />
      </div>

      <h4 className="text-lg mt-2">Approvers</h4>
      <div className="text-sm text-lightgray">
        Only these Telegram users can press Approve / Reject and use the bot&apos;s commands.
      </div>
      <ul className="flex flex-col gap-1">
        {telegram.approvers.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            {a.name || 'Unknown'} ({a.id})
            <button
              type="button"
              className="link text-sm"
              onClick={() => setTelegram({ ...telegram, approvers: telegram.approvers.filter((o) => o.id !== a.id) })}
            >
              remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <select className={inputClass} value="" onChange={(e) => addApprover(e.target.value)}>
          <option value="">Add a user who has opened the task board…</option>
          {data.tgUsers
            .filter((u) => !telegram.approvers.some((a) => a.id === u.id))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.username && ` @${u.username}`}
              </option>
            ))}
        </select>
        <input
          className={inputClass}
          value={newApprover}
          onChange={(e) => setNewApprover(e.target.value.trim())}
          placeholder="…or a numeric user id"
        />
        <button type="button" className="borderbutton" onClick={() => addApprover(newApprover)}>
          Add
        </button>
      </div>
      <button
        type="button"
        className="mainbutton self-start"
        onClick={() => run(() => saveSettings({ telegram }), 'Telegram settings saved.')}
      >
        Save Telegram settings
      </button>
    </Card>
  )
}

const DiscordCard = ({ data, run }: { data: SettingsResponse; run: Run }) => {
  const [guildId, setGuildId] = useState(data.settings.discord.guildId)
  useEffect(() => setGuildId(data.settings.discord.guildId), [data.settings.discord.guildId])
  return (
    <Card title="Discord">
      <Status ok={data.configured.discord}>
        {data.configured.discord ? 'Discord bot configured' : 'DISCORD_BOT_TOKEN is not set on the server'}
      </Status>
      <label className="flex flex-col gap-1">
        Server id
        <input className={inputClass} value={guildId} onChange={(e) => setGuildId(e.target.value)} />
      </label>
      <button
        type="button"
        className="mainbutton self-start"
        onClick={() => run(() => saveSettings({ discord: { guildId } }), 'Discord server saved.')}
      >
        Save Discord server
      </button>
    </Card>
  )
}

const InstagramCard = ({ data, run }: { data: SettingsResponse; run: Run }) => {
  const [account, setAccount] = useState<InstagramAccount | null>(null)
  return (
    <Card title="Instagram">
      <Status ok={data.configured.instagram}>
        {data.configured.instagram
          ? 'Instagram configured'
          : 'INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN are not set on the server'}
      </Status>
      {account && (
        <div className="flex flex-col gap-1">
          <div>
            Connected account: <strong>@{account.username}</strong>
            {account.accountType && ` (${account.accountType})`}
          </div>
          <div>
            Token expires:{' '}
            {account.tokenExpiresAt ? moment(account.tokenExpiresAt).format('D.M.YYYY') : 'not known until it is renewed'}
          </div>
          {account.lastError && <div className="text-red">Last renewal failed: {account.lastError}</div>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="borderbutton"
          disabled={!data.configured.instagram}
          onClick={() => run(async () => setAccount((await fetchInstagramAccount()).account), 'Connection works.')}
        >
          Test connection
        </button>
        <button
          type="button"
          className="borderbutton"
          disabled={!data.configured.instagram}
          onClick={() => run(async () => setAccount((await renewInstagramToken()).account), 'Token renewed.')}
        >
          Renew token now
        </button>
      </div>
      <div className="text-sm text-lightgray">The token is renewed automatically about once a week.</div>
    </Card>
  )
}

const emptyChannel = (platform: Platform): ChannelInput => ({
  platform,
  name: '',
  ref: '',
  defaultFooterMd: '',
  config: platform === 'discord' ? { channelId: '', crosspost: false } : platform === 'telegram' ? { chatId: '', threadId: '' } : {},
})

// Adds or edits a channel
const ChannelForm = ({
  value,
  onChange,
  data,
  discordChannels,
}: {
  value: ChannelInput
  onChange: (value: ChannelInput) => void
  data: SettingsResponse
  discordChannels: DiscordChannelOption[] | null
}) => {
  const config = value.config ?? {}
  const setConfig = (changes: Partial<NonNullable<ChannelInput['config']>>) =>
    onChange({ ...value, config: { ...config, ...changes } })
  return (
    <div className="grid grid-cols-1 md:grid-cols-[12rem_1fr] gap-2 items-center">
      <span>Name</span>
      <input className={inputClass} value={value.name ?? ''} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="e.g. AG main channel" />
      {value.platform === 'telegram' && (
        <>
          <span>Chat</span>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!config.manual} onChange={(e) => setConfig({ manual: e.target.checked })} />
              Forwarded by hand: the bot can&apos;t post here, so it sends the message to the review topic for someone to forward with &quot;Hide sender name&quot;
            </label>
            {!config.manual && (
              <>
                <select
                  className={inputClass}
                  value=""
                  onChange={(e) => {
                    const chat = data.knownChats.find((c) => `${c.chatId}/${c.threadId}` === e.target.value)
                    if (chat) {
                      onChange({
                        ...value,
                        name: value.name || chat.title,
                        config: { ...config, chatId: chat.chatId, threadId: chat.threadId },
                      })
                    }
                  }}
                >
                  <option value="">Pick a chat the bot knows (added to it, or /register)…</option>
                  {data.knownChats.map((c) => (
                    <option key={`${c.chatId}/${c.threadId}`} value={`${c.chatId}/${c.threadId}`}>
                      {c.title} ({c.type})
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <input className={inputClass} value={config.chatId ?? ''} onChange={(e) => setConfig({ chatId: e.target.value })} placeholder="Chat id or @channel" />
                  <input className={inputClass} value={config.threadId ?? ''} onChange={(e) => setConfig({ threadId: e.target.value })} placeholder="Topic id (optional)" />
                </div>
              </>
            )}
          </div>
        </>
      )}
      {value.platform === 'discord' && (
        <>
          <span>Channel</span>
          <div className="flex flex-col gap-2">
            {discordChannels ? (
              <select className={inputClass} value={config.channelId ?? ''} onChange={(e) => {
                const channel = discordChannels.find((c) => c.id === e.target.value)
                onChange({ ...value, name: value.name || channel?.name, config: { ...config, channelId: e.target.value } })
              }}>
                <option value="">Pick a channel…</option>
                {discordChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category ? `${c.category} / ` : ''}#{c.name}
                    {c.announcement ? ' (announcement)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input className={inputClass} value={config.channelId ?? ''} onChange={(e) => setConfig({ channelId: e.target.value })} placeholder="Channel id" />
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!config.crosspost} onChange={(e) => setConfig({ crosspost: e.target.checked })} />
              Also publish to the servers that follow this announcement channel
            </label>
          </div>
        </>
      )}
      <span>Ref</span>
      <input className={inputClass} value={value.ref ?? ''} onChange={(e) => onChange({ ...value, ref: e.target.value })} placeholder="Tag in tracked links (?ref=…), made from the name if empty" />
      <span>Default footer</span>
      <MarkdownEditor
        value={value.defaultFooterMd ?? ''}
        onChange={(defaultFooterMd) => onChange({ ...value, defaultFooterMd })}
        rows={2}
        placeholder="Added to the end of every post, e.g. Join us: {{link:discord}}"
      />
    </div>
  )
}

const ChannelRow = ({
  channel,
  data,
  discordChannels,
  run,
}: {
  channel: Channel
  data: SettingsResponse
  discordChannels: DiscordChannelOption[] | null
  run: Run
}) => {
  const [editing, setEditing] = useState<ChannelInput | null>(null)
  const [test, setTest] = useState<string | null>(null)
  const where =
    channel.platform === 'telegram'
      ? channel.config.manual
        ? 'forwarded by hand'
        : `chat ${channel.config.chatId}${channel.config.threadId ? `, topic ${channel.config.threadId}` : ''}`
      : channel.platform === 'discord'
        ? `#${discordChannels?.find((c) => c.id === channel.config.channelId)?.name ?? channel.config.channelId}${channel.config.crosspost ? ', published' : ''}`
        : ''
  return (
    <div className={`border border-lightgray/40 rounded-md p-3 flex flex-col gap-2 ${channel.enabled ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <strong>{channel.name}</strong>
        <span className="text-sm text-lightgray">
          {where} · ref {channel.ref}
          {!channel.enabled && ' · disabled'}
        </span>
        <div className="flex gap-3 ml-auto text-sm">
          {channel.platform === 'discord' && (
            <button
              type="button"
              className="link"
              onClick={() =>
                run(async () => {
                  const result = await testDiscordChannel(channel.config.channelId ?? '', !!channel.config.crosspost)
                  setTest(result.ok ? '✅ The bot can post here' : `⚠️ ${result.problems.join(', ')}`)
                })
              }
            >
              Test
            </button>
          )}
          <button type="button" className="link" onClick={() => setEditing(editing ? null : { ...channel })}>
            {editing ? 'Close' : 'Edit'}
          </button>
          <button
            type="button"
            className="link"
            onClick={() =>
              (!channel.enabled ||
                window.confirm(`Disable ${channel.name}? Approved posts that haven't been sent to it yet won't be.`)) &&
              run(() => updateChannel(channel.id, { enabled: !channel.enabled }), channel.enabled ? 'Disabled.' : 'Enabled.')
            }
          >
            {channel.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            className="link"
            onClick={() =>
              window.confirm(`Delete ${channel.name}? Approved posts that haven't been sent to it yet won't be. Channels that have posts are only disabled.`) &&
              run(async () => {
                const { result } = await deleteChannel(channel.id)
                return result
              }, 'Channel removed.')
            }
          >
            Delete
          </button>
        </div>
      </div>
      {channel.defaultFooterMd && <div className="text-sm text-lightgray">Footer: {channel.defaultFooterMd}</div>}
      {test && <div className="text-sm">{test}</div>}
      {editing && (
        <>
          <ChannelForm value={editing} onChange={setEditing} data={data} discordChannels={discordChannels} />
          <button
            type="button"
            className="mainbutton self-start"
            onClick={() =>
              run(async () => {
                await updateChannel(channel.id, {
                  name: editing.name,
                  config: editing.config,
                  ref: editing.ref,
                  defaultFooterMd: editing.defaultFooterMd,
                })
                setEditing(null)
              }, 'Channel saved.')
            }
          >
            Save channel
          </button>
        </>
      )}
    </div>
  )
}

const ChannelsCard = ({ data, run }: { data: SettingsResponse; run: Run }) => {
  const [adding, setAdding] = useState<ChannelInput | null>(null)
  const [discordChannels, setDiscordChannels] = useState<DiscordChannelOption[] | null>(null)
  useEffect(() => {
    if (data.configured.discord && data.settings.discord.guildId) {
      fetchDiscordChannels().then((r) => setDiscordChannels(r.channels)).catch(() => setDiscordChannels(null))
    }
  }, [data.configured.discord, data.settings.discord.guildId])

  const visible = data.channels.filter((c) => !c.deleted)
  return (
    <Card title="Channels">
      <div className="text-sm text-lightgray">
        Where posts can be sent. Every channel has a name, a ref (tag in tracked links) and an optional
        default footer. Nothing is sent to disabled channels, and they can&apos;t be picked for new posts.
      </div>
      {PLATFORMS.map((platform) => (
        <div key={platform} className="flex flex-col gap-2">
          <h4 className="text-lg">{PLATFORM_LABELS[platform]}</h4>
          {visible
            .filter((c) => c.platform === platform)
            .map((c) => (
              <ChannelRow key={c.id} channel={c} data={data} discordChannels={discordChannels} run={run} />
            ))}
          {adding?.platform === platform ? (
            <div className="border border-red rounded-md p-3 flex flex-col gap-2">
              <ChannelForm value={adding} onChange={setAdding} data={data} discordChannels={discordChannels} />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="mainbutton"
                  onClick={() =>
                    run(async () => {
                      await createChannel(adding)
                      setAdding(null)
                    }, 'Channel added.')
                  }
                >
                  Add channel
                </button>
                <button type="button" className="borderbutton" onClick={() => setAdding(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="link self-start text-sm" onClick={() => setAdding(emptyChannel(platform))}>
              + Add {PLATFORM_LABELS[platform]} channel
            </button>
          )}
        </div>
      ))}
    </Card>
  )
}

// /admin/posts/settings: bots, review chat, approvers and channels
const PostSettings = () => {
  const [data, setData] = useState<SettingsResponse | null>(null)
  const toast = useToast()

  const load = useCallback(async () => setData(await fetchSettings()), [])
  useEffect(() => {
    load().catch((e) => toast(e.message, { isError: true }))
  }, [load, toast])

  const run: Run = async (work, done) => {
    try {
      await work()
      await load()
      if (done) toast(done)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), { isError: true })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/posts" className="link">
          ← Posts
        </Link>
        <h2 className="text-2xl">Post settings</h2>
      </div>
      {!data ? (
        <div>Loading…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <TelegramCard data={data} run={run} />
          <div className="flex flex-col gap-6">
            <DiscordCard data={data} run={run} />
            <InstagramCard data={data} run={run} />
          </div>
          <div className="xl:col-span-2">
            <ChannelsCard data={data} run={run} />
          </div>
        </div>
      )}
    </div>
  )
}

export default PostSettings
