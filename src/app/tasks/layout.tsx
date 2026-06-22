import Script from 'next/script'
import TelegramProvider from '../../components/tasks/TelegramProvider'

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        nav, footer, .tg-hide { display: none !important; }
        html { height: 100dvh; overflow: hidden; }
        body { height: 100%; overflow: hidden; min-height: 0 !important; }
        body > div { height: 100%; min-height: 0 !important; }
        main { min-height: 0 !important; overflow-y: auto; }
      ` }} />
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
      />
      <TelegramProvider>{children}</TelegramProvider>
    </>
  )
}
