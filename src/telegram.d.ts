interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
    }
    chat_instance?: string
    chat_type?: string
    start_param?: string
    auth_date: number
    hash: string
  }
  ready: () => void
  close: () => void
  expand: () => void
  MainButton: {
    text: string
    show: () => void
    hide: () => void
    onClick: (fn: () => void) => void
  }
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
  }
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
}
