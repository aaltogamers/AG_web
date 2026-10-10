import { parseJsonBody } from '../../../utils/apiUtils'
import {
  getSettings,
  listChannels,
  listKnownChats,
  listTgUsers,
  saveSettings,
} from '../../../utils/postStore'
import { adminRoute } from '../../../utils/social/adminApi'
import { isDiscordConfigured } from '../../../utils/social/discord'
import { isInstagramConfigured } from '../../../utils/social/instagram'
import { isTelegramConfigured } from '../../../utils/social/telegram'
import type { SocialSettings } from '../../../utils/social/types'

// Admin: posts settings, channels, the chats the posts bot knows and the users
// approvers can be picked from. Never returns tokens.
export default adminRoute({
  GET: async () => {
    const [settings, channels, knownChats, tgUsers] = await Promise.all([
      getSettings(),
      listChannels(),
      listKnownChats(),
      listTgUsers(),
    ])
    return {
      settings,
      channels,
      knownChats,
      tgUsers,
      configured: {
        telegram: isTelegramConfigured(),
        telegramWebhookSecret: !!process.env.TELEGRAM_POSTS_WEBHOOK_SECRET,
        discord: isDiscordConfigured(),
        instagram: isInstagramConfigured(),
      },
    }
  },
  PUT: async (req) => ({
    settings: await saveSettings(parseJsonBody<Partial<SocialSettings>>(req) ?? {}),
  }),
})
