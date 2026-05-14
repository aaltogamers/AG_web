'use client'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'

import AdminLoginForm from '../../../components/AdminLoginForm'
import PageWrapper from '../../../components/PageWrapper'
import TournamentBracketView, {
  defaultBracketStyles,
} from '../../../components/TournamentBracketView'
import { StreamConfig, Tournament } from '../../../types/types'
import { checkAdminSession } from '../../../utils/adminAuth'
import {
  buildStreamParamDocs,
  parseStreamBracketStyles,
  parseStreamStageFilter,
  type StreamParamDoc,
} from '../../../utils/streamMode'
import {
  createStreamConfig,
  deleteStreamConfig,
  listStreamConfigs,
  updateStreamConfig,
} from '../../../utils/streamConfigApi'
import { getTournament } from '../../../utils/tournamentApi'

const STAGE_OPTIONS = ['', 'all', 'qualifier', 'winners', 'losers', 'finals'] as const

const STREAM_FLAGS = new Set(['stream', 'fullscreen'])

// Build a record of `paramName -> string value` from a saved query string.
// `stream`/`fullscreen` flags are stripped since the form always implies stream
// mode.
const queryStringToFormValues = (query: string): Record<string, string> => {
  const params = new URLSearchParams(query)
  const out: Record<string, string> = {}
  params.forEach((value, key) => {
    if (STREAM_FLAGS.has(key)) return
    out[key] = value
  })
  return out
}

// Inverse: build the canonical `stream&key=value&...` string from a form
// state. Empty values are omitted (they fall back to defaults).
const formValuesToQueryString = (values: Record<string, string>): string => {
  const parts: string[] = ['stream']
  Object.entries(values).forEach(([key, value]) => {
    if (!value || !value.trim()) return
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value.trim())}`)
  })
  return parts.join('&')
}

const StreamCustomizationPage = () => {
  const router = useRouter()
  const rawSlug = router.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [tournamentLoading, setTournamentLoading] = useState(true)

  const [configs, setConfigs] = useState<StreamConfig[]>([])
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [configName, setConfigName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const [formValues, setFormValues] = useState<Record<string, string>>({})

  const [origin, setOrigin] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdminSession()
      setIsLoggedIn(ok)
      setCheckedSession(true)
    })()
  }, [])

  const refreshConfigs = useCallback(async () => {
    if (!slug) return
    const list = await listStreamConfigs(slug)
    setConfigs(list)
  }, [slug])

  useEffect(() => {
    if (!router.isReady || !slug || !isLoggedIn) return
    ;(async () => {
      const t = await getTournament(slug)
      setTournament(t)
      setTournamentLoading(false)
    })()
    refreshConfigs()
  }, [router.isReady, slug, isLoggedIn, refreshConfigs])

  const docs = useMemo(() => buildStreamParamDocs(defaultBracketStyles), [])
  const editableDocs = useMemo<StreamParamDoc[]>(
    () => docs.filter((d) => !STREAM_FLAGS.has(d.name)),
    [docs]
  )

  const queryString = useMemo(() => formValuesToQueryString(formValues), [formValues])
  const generatedUrl = slug
    ? `${origin}/tournaments/${encodeURIComponent(slug)}?${queryString}`
    : ''

  // Recompute the preview styles/filter from the current form state. The
  // parsers happily accept a plain Record<string,string> since it matches the
  // shape of ParsedUrlQuery values.
  const previewBracketStyles = useMemo(
    () => parseStreamBracketStyles(formValues, defaultBracketStyles),
    [formValues]
  )
  const previewStageFilter = useMemo(() => parseStreamStageFilter(formValues), [formValues])

  const updateValue = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const clearForm = () => {
    setFormValues({})
    setConfigName('')
    setEditingConfigId(null)
    setMessage(null)
  }

  const loadConfig = (cfg: StreamConfig) => {
    setFormValues(queryStringToFormValues(cfg.query))
    setConfigName(cfg.name)
    setEditingConfigId(cfg.id)
    setMessage(null)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Copied!')
      setTimeout(() => setMessage(null), 1500)
    } catch {
      setMessage('Failed to copy')
    }
  }

  const onSave = async () => {
    if (!slug) return
    if (!configName.trim()) {
      setMessage('Name is required to save.')
      return
    }
    try {
      if (editingConfigId) {
        await updateStreamConfig(slug, editingConfigId, {
          name: configName.trim(),
          query: queryString,
        })
        setMessage('Updated.')
      } else {
        const created = await createStreamConfig(slug, {
          name: configName.trim(),
          query: queryString,
        })
        setEditingConfigId(created.id)
        setMessage('Saved.')
      }
      await refreshConfigs()
      setTimeout(() => setMessage(null), 1500)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    }
  }

  const onDelete = async (cfg: StreamConfig) => {
    if (!slug) return
    if (!confirm(`Delete configuration "${cfg.name}"?`)) return
    try {
      await deleteStreamConfig(slug, cfg.id)
      if (editingConfigId === cfg.id) clearForm()
      await refreshConfigs()
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`)
    }
  }

  if (!checkedSession) {
    return (
      <PageWrapper>
        <div className="mt-8 text-center">Checking session…</div>
      </PageWrapper>
    )
  }
  if (!isLoggedIn) {
    return (
      <PageWrapper>
        <Head>
          <title>Stream customization - Aalto Gamers</title>
        </Head>
        <div className="mt-8">
          <AdminLoginForm onLoggedIn={() => setIsLoggedIn(true)} />
        </div>
      </PageWrapper>
    )
  }

  const inputForDoc = (doc: StreamParamDoc) => {
    const value = formValues[doc.name] ?? ''
    const commonClass = 'p-2 rounded-md bg-white text-black w-full md:w-64 disabled:opacity-50'
    if (doc.name === 'stage') {
      return (
        <select
          value={value}
          onChange={(e) => updateValue(doc.name, e.target.value)}
          className={commonClass}
        >
          {STAGE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === '' ? `(default: ${doc.defaultValue})` : opt}
            </option>
          ))}
        </select>
      )
    }
    if (doc.type === 'number') {
      return (
        <input
          type="number"
          value={value}
          placeholder={doc.defaultValue}
          onChange={(e) => updateValue(doc.name, e.target.value)}
          className={commonClass}
        />
      )
    }
    if (doc.type === 'color') {
      const colorPickerValue = /^#[0-9a-fA-F]{6}$/.test(value)
        ? value
        : /^[0-9a-fA-F]{6}$/.test(value)
          ? `#${value}`
          : (doc.defaultValue ?? '#000000')
      return (
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={colorPickerValue}
            onChange={(e) => updateValue(doc.name, e.target.value)}
            className="w-10 h-10 rounded border border-lightgray bg-white"
            aria-label={`${doc.name} color picker`}
          />
          <input
            type="text"
            value={value}
            placeholder={doc.defaultValue ?? ''}
            onChange={(e) => updateValue(doc.name, e.target.value)}
            className={commonClass}
          />
        </div>
      )
    }
    return null
  }

  return (
    <PageWrapper>
      <Head>
        <title>Stream customization - Aalto Gamers</title>
      </Head>
      <div className="mt-8 mb-12">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h2 className="text-4xl">
            Stream customization{tournament ? ` — ${tournament.name}` : ''}
          </h2>
          {slug && (
            <Link href={`/tournaments/${encodeURIComponent(slug)}`} className="borderbutton">
              Back to bracket
            </Link>
          )}
        </div>

        <p className="mb-4 text-sm opacity-90">
          Stream mode renders the bracket without site chrome and on a transparent background, so
          the URL can be added to OBS as a browser source. Use the form to build a URL, see a live
          preview below, and optionally save the configuration to share or reuse later.
        </p>

        <div className="mb-6">
          <label className="block text-sm mb-1">Generated URL</label>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={generatedUrl}
              className="flex-1 p-2 rounded-md bg-white text-black font-mono text-sm"
            />
            <button
              type="button"
              className="borderbutton"
              onClick={() => copyToClipboard(generatedUrl)}
            >
              Copy
            </button>
            {generatedUrl && (
              <a
                href={generatedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="borderbutton"
              >
                Open
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          <h3 className="text-2xl">Parameters</h3>
          {editableDocs.map((doc) => (
            <div
              key={doc.name}
              className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 border-b border-darkgray pb-3"
            >
              <div className="md:w-72">
                <div className="font-mono">{doc.name}</div>
              </div>
              <div className="flex-1 text-sm opacity-90">{doc.description}</div>
              <div>{inputForDoc(doc)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-3 mb-2">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-sm">Configuration name</span>
            <input
              type="text"
              value={configName}
              placeholder="ex. Qualifiers stream"
              onChange={(e) => setConfigName(e.target.value)}
              className="p-2 rounded-md bg-white text-black"
            />
          </label>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="mainbutton" onClick={onSave}>
              {editingConfigId ? 'Update saved' : 'Save'}
            </button>
            {(editingConfigId || configName || Object.keys(formValues).length > 0) && (
              <button type="button" className="borderbutton" onClick={clearForm}>
                Cancel
              </button>
            )}
          </div>
        </div>
        {message && <div className="text-sm">{message}</div>}

        <div className="mt-8">
          <h3 className="text-2xl mb-3">Saved configurations</h3>
          {configs.length === 0 ? (
            <div className="opacity-75 text-sm">No configurations saved yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {configs.map((cfg) => {
                const url = `${origin}/tournaments/${encodeURIComponent(slug ?? '')}?${cfg.query}`
                return (
                  <div
                    key={cfg.id}
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 border-2 ${
                      editingConfigId === cfg.id ? 'border-red' : 'border-darkgray'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xl">{cfg.name}</div>
                      <div className="text-xs opacity-75 font-mono truncate">?{cfg.query}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="borderbutton"
                        onClick={() => copyToClipboard(url)}
                      >
                        Copy URL
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="borderbutton"
                      >
                        Open URL
                      </a>
                      <button
                        type="button"
                        className="borderbutton"
                        onClick={() => loadConfig(cfg)}
                      >
                        Edit
                      </button>
                      <button type="button" className="borderbutton" onClick={() => onDelete(cfg)}>
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-12">
          <h3 className="text-2xl mb-3">Live preview</h3>
          {tournamentLoading ? (
            <div className="opacity-75 text-sm">Loading…</div>
          ) : !tournament ? (
            <div className="opacity-75 text-sm">Tournament not found.</div>
          ) : !tournament.data ? (
            <div className="opacity-75 text-sm">
              The bracket for this tournament hasn&apos;t been built yet.
            </div>
          ) : (
            <div className="p-4 border-2 border-darkgray bg-black/40 overflow-x-auto">
              <TournamentBracketView
                tournament={tournament}
                isAdmin={false}
                bracketStyles={previewBracketStyles}
                visibleStages={previewStageFilter.stageIndices}
                visibleGroups={previewStageFilter.groups}
              />
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

export default StreamCustomizationPage
