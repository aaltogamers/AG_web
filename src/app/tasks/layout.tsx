import Script from 'next/script'
import TelegramProvider from '../../components/tasks/TelegramProvider'

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
      />
      <TelegramProvider>{children}</TelegramProvider>
    </>
  )
}
