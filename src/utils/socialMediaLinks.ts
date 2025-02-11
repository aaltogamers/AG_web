import {
  FaGamepad,
  FaDiscord,
  FaTelegram,
  FaCalendarDay,
  FaInstagram,
  FaTwitch,
} from 'react-icons/fa'

export const medias = [
  {
    name: 'Become a member',
    link: `/link/member-form?ref=website`,
    Icon: FaGamepad,
  },
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
    name: 'Add our events to your calendar',
    link: `/link/calendar?ref=website`,
    Icon: FaCalendarDay,
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
