interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
    }
    chat?: {
      id: number
      type: string
      title?: string
      username?: string
    }
    chat_instance?: string
    chat_type?: string
    start_param?: string
    auth_date: number
    hash: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  ready: () => void
  close: () => void
  expand: () => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  MainButton: {
    text: string
    isVisible: boolean
    isActive: boolean
    setText: (text: string) => TelegramWebApp['MainButton']
    show: () => TelegramWebApp['MainButton']
    hide: () => TelegramWebApp['MainButton']
    enable: () => TelegramWebApp['MainButton']
    disable: () => TelegramWebApp['MainButton']
    onClick: (fn: () => void) => TelegramWebApp['MainButton']
    offClick: (fn: () => void) => TelegramWebApp['MainButton']
    showProgress: (leaveActive?: boolean) => TelegramWebApp['MainButton']
    hideProgress: () => TelegramWebApp['MainButton']
  }
  BackButton: {
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (fn: () => void) => void
    offClick: (fn: () => void) => void
  }
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
    header_bg_color?: string
    bottom_bar_bg_color?: string
    accent_text_color?: string
    section_bg_color?: string
    section_header_text_color?: string
    section_separator_color?: string
    subtitle_text_color?: string
    destructive_text_color?: string
  }
  onEvent: (eventType: string, callback: () => void) => void
  offEvent: (eventType: string, callback: () => void) => void
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
}
