import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Select from 'react-select'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { fetchAdmin } from '../utils/adminAuth'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type Totals = { path: string; count: number }[]
type Series = { bucket: string; count: number }[]

const getQueryString = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const SiteStatistics = () => {
  const router = useRouter()

  const selectedPath = getQueryString(router.query.path) || null
  const from = getQueryString(router.query.from)
  const to = getQueryString(router.query.to)

  const [totals, setTotals] = useState<Totals | null>(null)
  const [series, setSeries] = useState<{ total: number; series: Series } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const timeframeValid =
    Boolean(from && to) && new Date(from).getTime() < new Date(to).getTime()
  const canDeleteStatistics = Boolean(selectedPath) && timeframeValid

  const updateQuery = useCallback(
    (next: Partial<{ path: string | null; from: string; to: string }>) => {
      setSuccessMessage(null)
      const merged: Record<string, string> = {}
      const currentPath = selectedPath
      const currentFrom = from
      const currentTo = to

      const nextPath = 'path' in next ? next.path : currentPath
      const nextFrom = 'from' in next ? next.from ?? '' : currentFrom
      const nextTo = 'to' in next ? next.to ?? '' : currentTo

      if (nextPath) merged.path = nextPath
      if (nextFrom) merged.from = nextFrom
      if (nextTo) merged.to = nextTo

      merged.section = getQueryString(router.query.section) || 'stats'

      router.replace({ pathname: router.pathname, query: merged }, undefined, {
        shallow: true,
      })
    },
    [router, selectedPath, from, to]
  )

  const loadTotals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetchAdmin(`/api/analytics/stats?${params.toString()}`)
      if (res.status === 401) {
        setError('Admin session expired. Please log in again.')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { totals: Totals }
      setTotals(data.totals)
    } catch (e) {
      if (e instanceof Error) setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  const loadSeries = useCallback(async () => {
    if (!selectedPath) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('path', selectedPath)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetchAdmin(`/api/analytics/stats?${params.toString()}`)
      if (res.status === 401) {
        setError('Admin session expired. Please log in again.')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { total: number; series: Series }
      setSeries(data)
    } catch (e) {
      if (e instanceof Error) setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedPath, from, to])

  const deleteStatistics = useCallback(async () => {
    if (!selectedPath || !timeframeValid) return
    const path = selectedPath
    const detail =
      `Delete ALL page view statistics for:\n\n` +
      `Path: ${path}\n` +
      `From: ${from}\n` +
      `To: ${to}\n\n` +
      `This cannot be undone. Continue?`
    if (!window.confirm(detail)) return
    if (!window.confirm('Final confirmation: permanently delete these records from the database?')) return

    setSuccessMessage(null)
    setDeleting(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('path', path)
      params.set('from', from)
      params.set('to', to)
      const res = await fetch(`/api/analytics/stats?${params.toString()}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (res.status === 401) {
        setError('Admin session expired. Please log in again.')
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { deleted: number }
      setSuccessMessage(`Deleted ${data.deleted} row(s).`)
      await loadTotals()
      await loadSeries()
    } catch (e) {
      if (e instanceof Error) setError(e.message)
    } finally {
      setDeleting(false)
    }
  }, [selectedPath, timeframeValid, from, to, loadTotals, loadSeries])

  useEffect(() => {
    loadTotals()
  }, [from, to, loadTotals])

  useEffect(() => {
    if (selectedPath) {
      loadSeries()
    } else {
      setSeries(null)
    }
  }, [selectedPath, from, to, loadSeries])

  const pathOptions = useMemo(() => {
    if (!totals) return []
    return totals.map((t) => ({
      value: t.path,
      label: `${t.path} (${t.count})`,
    }))
  }, [totals])

  const selectedOption = useMemo(() => {
    if (!selectedPath) return null
    return pathOptions.find((o) => o.value === selectedPath) ?? { value: selectedPath, label: selectedPath }
  }, [pathOptions, selectedPath])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[300px]">
          <label className="block text-sm mb-1">Path</label>
          <Select
            instanceId="analytics-path"
            isClearable
            options={pathOptions}
            value={selectedOption}
            onChange={(opt) => updateQuery({ path: opt ? opt.value : null })}
            placeholder="Select a path..."
            className="text-black"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => updateQuery({ from: e.target.value })}
            className="bg-white text-black p-2 rounded border border-neutral-300"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => updateQuery({ to: e.target.value })}
            className="bg-white text-black p-2 rounded border border-neutral-300"
          />
        </div>
        {canDeleteStatistics && (
          <button
            type="button"
            className="mainbutton disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={deleting}
            onClick={deleteStatistics}
          >
            {deleting ? 'Deleting' : 'Delete'}
          </button>
        )}
      </div>

      {error && <p className="text-red">{error}</p>}
      {successMessage && <p className="text-green-400">{successMessage}</p>}
      {loading && <p>Loading…</p>}

      {!selectedPath && totals && (
        <div>
          <h3 className="text-2xl mb-2">All paths</h3>
          <div className="grid" style={{ gridTemplateColumns: 'auto 1fr' }}>
            {totals.map(({ path, count }) => (
              <React.Fragment key={path}>
                <span className="text-right pr-10">{count}</span>
                <button
                  className="text-left underline"
                  onClick={() => updateQuery({ path })}
                >
                  {path}
                </button>
              </React.Fragment>
            ))}
            {totals.length === 0 && <span className="col-span-2">No data.</span>}
          </div>
        </div>
      )}

      {selectedPath && series && (
        <div>
          <h3 className="text-2xl mb-2">
            {selectedPath} — {series.total} views
          </h3>
          {series.series.length === 0 ? (
            <p>No data.</p>
          ) : (
            <div className="bg-white p-4 rounded" style={{ height: 400 }}>
              <Line
                data={{
                  labels: series.series.map(({ bucket }) =>
                    new Date(bucket).toLocaleDateString()
                  ),
                  datasets: [
                    {
                      label: 'Views',
                      data: series.series.map(({ count }) => count),
                      borderColor: '#dc2626',
                      backgroundColor: 'rgba(220, 38, 38, 0.2)',
                      fill: true,
                      tension: 0.25,
                      pointRadius: 3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        title: (items) => items[0]?.label ?? '',
                        label: (ctx) => `${ctx.parsed.y} views`,
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0 },
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SiteStatistics
