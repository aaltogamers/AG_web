'use client'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

import AdminLoginForm from '../../../components/AdminLoginForm'
import PageWrapper from '../../../components/PageWrapper'
import { defaultBracketStyles } from '../../../components/TournamentBracketView'
import { checkAdminSession } from '../../../utils/adminAuth'
import { buildStreamParamDocs } from '../../../utils/streamMode'

const StreamInfoPage = () => {
  const router = useRouter()
  const rawSlug = router.query.slug
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdminSession()
      setIsLoggedIn(ok)
      setCheckedSession(true)
    })()
  }, [])

  const docs = useMemo(() => buildStreamParamDocs(defaultBracketStyles), [])

  const baseUrl = slug ? `/tournaments/${encodeURIComponent(slug)}` : ''
  const sampleBase = baseUrl ? `${baseUrl}?stream` : ''

  return (
    <PageWrapper>
      <Head>
        <title>Stream info - Aalto Gamers</title>
      </Head>
      <div className="mt-8">
        {!checkedSession ? (
          <div className="text-center">Checking session…</div>
        ) : !isLoggedIn ? (
          <AdminLoginForm onLoggedIn={() => setIsLoggedIn(true)} />
        ) : (
          <>
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
              <h2 className="text-4xl">Stream info</h2>
              {slug && (
                <Link href={baseUrl} className="borderbutton">
                  Back to bracket
                </Link>
              )}
            </div>

            <p className="mb-4">
              Stream mode renders just the bracket with a transparent background, so it can be used
              as an OBS browser source. Toggle it by adding <code>?stream</code> to the bracket URL.
              Every option below is a query parameter you can append to that URL with{' '}
              <code>&amp;name=value</code>.
            </p>

            {sampleBase && (
              <p className="mb-8">
                Example:{' '}
                <a
                  href={`${sampleBase}&stage=winners&textColor=ffffff&teamWidth=180`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                >
                  {sampleBase}&amp;stage=winners&amp;textColor=ffffff&amp;teamWidth=180
                </a>
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-lightgray text-left">
                    <th className="py-2 pr-4">Parameter</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Default</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => {
                    const exampleHref = sampleBase
                      ? doc.type === 'flag'
                        ? `${baseUrl}?${doc.example}`
                        : `${sampleBase}&${doc.example}`
                      : ''
                    return (
                      <tr key={doc.name} className="border-b border-darkgray align-top">
                        <td className="py-2 pr-4 font-mono">{doc.name}</td>
                        <td className="py-2 pr-4">{doc.type}</td>
                        <td className="py-2 pr-4 font-mono">{doc.defaultValue ?? '—'}</td>
                        <td className="py-2 pr-4">{doc.description}</td>
                        <td className="py-2 pr-4">
                          {exampleHref ? (
                            <a
                              href={exampleHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link font-mono"
                            >
                              {doc.example}
                            </a>
                          ) : (
                            <span className="font-mono">{doc.example}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PageWrapper>
  )
}

export default StreamInfoPage
