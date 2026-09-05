import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { loginAdmin, checkAdminSession } from '../utils/adminAuth'

type LogEntry = {
  id: number
  event: string
  created_at: string
}

const adminFetch = (url: string) => fetch(url, { credentials: 'same-origin' })

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const ok = await loginAdmin(password)
    setLoading(false)
    if (ok) onLogin()
    else setError(true)
  }

  return (
    <div className="flex items-center justify-center h-dvh p-8">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1a1a22] p-10 rounded-2xl w-full max-w-[400px] flex flex-col gap-4"
      >
        <h1 className="text-2xl text-center mb-2">Fridge Inventory Logs</h1>
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="px-4 py-3.5 rounded-lg border border-[#333] bg-[#0f0f13] text-[#e8e8eb] text-base"
        />
        <button
          type="submit"
          disabled={loading}
          className="py-3.5 rounded-lg border-none bg-[#6366f1] text-white text-base font-semibold cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>
        {error && <p className="text-[#f87171] text-center">Wrong password</p>}
      </form>
    </div>
  )
}

export default function FridgeInventoryLogsPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const loadLogs = useCallback(async (before?: number) => {
    setLoading(true)
    const url = before
      ? `/api/fridge/logs?limit=200&before=${before}`
      : '/api/fridge/logs?limit=200'
    const res = await adminFetch(url)
    if (res.ok) {
      const data = await res.json()
      if (before) {
        setLogs((prev) => [...prev, ...data.logs])
      } else {
        setLogs(data.logs)
      }
      setHasMore(data.logs.length === 200)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    checkAdminSession().then((ok) => {
      setAuthed(ok)
      if (ok) loadLogs()
    })
  }, [loadLogs])

  const handleLogin = () => {
    setAuthed(true)
    loadLogs()
  }

  const loadMore = () => {
    if (logs.length > 0) {
      loadLogs(logs[logs.length - 1].id)
    }
  }

  if (authed === null) {
    return (
      <>
        <Head>
          <title>Fridge Inventory Logs</title>
        </Head>
        <div className="flex items-center justify-center h-dvh text-xl text-[#888] bg-[#0f0f13] text-[#e8e8eb]">
          Loading…
        </div>
      </>
    )
  }

  if (!authed) {
    return (
      <>
        <Head>
          <title>Fridge Inventory Logs</title>
        </Head>
        <div className="bg-[#0f0f13] text-[#e8e8eb]">
          <LoginScreen onLogin={handleLogin} />
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Fridge Inventory Logs</title>
      </Head>
      <div className="flex flex-col h-dvh bg-[#0f0f13] text-[#e8e8eb] font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] [&_*]:box-border">
        <div className="border-b border-[#2a2a35] bg-[#1a1a22] shrink-0 px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
          <h1 className="text-lg m-0">Fridge Inventory Logs</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[900px] mx-auto">
            {logs.length === 0 && !loading && (
              <p className="text-[#666] text-center py-8">No logs yet</p>
            )}
            <div className="flex flex-col gap-1.5">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-3 py-2.5 bg-[#1a1a22] rounded-lg"
                >
                  <div className="flex-1">
                    <div className="text-sm">{log.event}</div>
                    <div className="text-xs text-[#666] mt-0.5">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && logs.length > 0 && (
              <button
                className="w-full mt-4 px-6 py-3 rounded-lg border border-[#2a2a35] bg-transparent text-[#6366f1] text-sm font-semibold cursor-pointer disabled:opacity-50"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
            {loading && logs.length === 0 && (
              <p className="text-[#666] text-center py-8">Loading…</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
