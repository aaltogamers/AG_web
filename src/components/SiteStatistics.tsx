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
import { fetchAnalytics } from '../utils/analyticsAuth'

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
  const [loading, setLoading] = useState(false)

  const updateQuery = useCallback(
    (next: Partial<{ path: string | null; from: string; to: string }>) => {
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
      const res = await fetchAnalytics(`/api/analytics/stats?${params.toString()}`)
      if (res.status === 401) {
        setError('Analytics session expired. Please log in again.')
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
      const res = await fetchAnalytics(`/api/analytics/stats?${params.toString()}`)
      if (res.status === 401) {
        setError('Analytics session expired. Please log in again.')
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
            className="text-black p-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => updateQuery({ to: e.target.value })}
            className="text-black p-2"
          />
        </div>
        <button
          className="mainbutton"
          onClick={() => {
            if (selectedPath) loadSeries()
            else loadTotals()
          }}
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-red">{error}</p>}
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
