import { FaGamepad, FaDiscord, FaTelegram, FaInstagram, FaTwitch } from 'react-icons/fa'

export const medias = [
  {
    name: 'Join our discord server',
    link: `/link/discord?ref=website`,
    Icon: FaDiscord,
  },
  {
    name: 'Join our telegram group',
    link: `/link/telegram?ref=website`,
    Icon: FaTelegram,
  },

  {
    name: 'Become an official member (free)',
    link: `/link/member-form?ref=website`,
    Icon: FaGamepad,
  },
  {
    name: 'Check out our instagram',
    link: `/link/instagram?ref=website`,
    Icon: FaInstagram,
  },
  {
    name: 'Watch us on twitch',
    link: `/link/twitch?ref=website`,
    Icon: FaTwitch,
  },
]
