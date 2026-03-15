import { FaGamepad, FaDiscord, FaTelegram, FaInstagram, FaTwitch, FaYoutube } from 'react-icons/fa'

export const medias = [
  {
    name: 'Join our Discord server',
    link: `/link/discord?ref=website`,
    Icon: FaDiscord,
  },
  {
    name: 'Join our Telegram group',
    link: `/link/telegram?ref=website`,
    Icon: FaTelegram,
  },

  {
    name: 'Become an official member (free)',
    link: `/link/member-form?ref=website`,
    Icon: FaGamepad,
  },
  {
    name: 'Check out our Instagram',
    link: `/link/instagram?ref=website`,
    Icon: FaInstagram,
  },
  {
    name: 'Watch us live on Twitch',
    link: `/link/twitch?ref=website`,
    Icon: FaTwitch,
  },
  {
    name: 'Watch our recordings on YouTube',
    link: `/link/youtube?ref=website`,
    Icon: FaYoutube,
  },
]
