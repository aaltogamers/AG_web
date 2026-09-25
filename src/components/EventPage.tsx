import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import Header from './Header'
import CmsEditLink, { AdminLinkButton } from './CmsEditLink'
import Markdown from './Markdown'
import PageWrapper from './PageWrapper'
import AGImage from './AGImage'
import CapacityBar from './CapacityBar'
import EventDetails, { scrollToSignups } from './EventDetails'
import ParticipantList from './ParticipantList'
import SignupDialog from './SignupDialog'
import { AGEvent, SignupRow } from '../types/types'
import { LYCHEE_BASE_URL } from '../utils/constants'
import {
  eventMoment,
  formatSessionTime,
  getSignupStatus,
  getSignupTargets,
} from '../utils/eventUtils'
import { getSignupSummaries, getStoredSignup, listSignups, SignupSummary } from '../utils/signupApi'
import { totalFill } from '../utils/signupPools'
import { useNow } from '../utils/useNow'

type Props = {
  event: AGEvent
  // The CMS preview hides sign-ups so editors can't sign up by accident
  showSignUp?: boolean
}

type SignupList = { key: string; participants: SignupRow[]; ownSignupId: string | null }

const fetchSignupList = async (key: string): Promise<SignupList> => {
  const { signups, ownSignupId } = await listSignups(key, getStoredSignup(key)?.token)
  return { key, participants: signups, ownSignupId }
}

const EventPage = ({ event, showSignUp = true }: Props) => {
  const now = useNow()
  const [summaries, setSummaries] = useState<Record<string, SignupSummary>>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [signupList, setSignupList] = useState<SignupList | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Enabling sign-ups in the CMS does nothing until the form is created in the admin panel
  const targets = getSignupTargets(event).filter((t) => summaries[t.key])
  const targetKeys = getSignupTargets(event)
    .map((t) => t.key)
    .join(',')

  const loadSummaries = useCallback(async () => {
    const list = await getSignupSummaries(targetKeys ? targetKeys.split(',') : [])
    return Object.fromEntries(list.map((s) => [s.key, s]))
  }, [targetKeys])

  useEffect(() => {
    setSelectedKey(null)
    setSummaries({})
    if (!showSignUp || !targetKeys) return
    let cancelled = false
    loadSummaries().then((loaded) => {
      if (!cancelled) setSummaries(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [loadSummaries, targetKeys, showSignUp])

  // Default to the next upcoming session, or the most recent one if all are past
  const defaultTarget =
    (now && targets.find((t) => !t.session || eventMoment(t.session.end).isAfter(now))) ||
    targets[targets.length - 1]
  const selectedTarget = targets.find((t) => t.key === selectedKey) ?? defaultTarget
  const selectedSummary = selectedTarget && summaries[selectedTarget.key]
  const selectedTargetKey = selectedTarget?.key
  // Also link sign-ups that are enabled in the CMS but not yet created in the admin panel
  const adminSignupKey = selectedTargetKey ?? targetKeys.split(',')[0]

  useEffect(() => {
    if (!selectedTargetKey) return
    let cancelled = false
    fetchSignupList(selectedTargetKey).then((list) => {
      if (!cancelled) setSignupList(list)
    })
    return () => {
      cancelled = true
    }
  }, [selectedTargetKey])

  const currentList = signupList?.key === selectedTargetKey ? signupList : null

  const refresh = async () => {
    const [loaded, list] = await Promise.all([
      loadSummaries(),
      selectedTargetKey ? fetchSignupList(selectedTargetKey) : null,
    ])
    setSummaries(loaded)
    setSignupList(list)
  }

  // The loaded list knows for sure; for other sign-ups, trust what this browser remembers.
  // Storage is only read after the first render so the server and browser render the same.
  const isSignedUp = (key: string) =>
    currentList?.key === key ? !!currentList.ownSignupId : !!now && !!getStoredSignup(key)

  const openDialog = (key: string) => {
    setSelectedKey(key)
    setIsDialogOpen(true)
  }

  // On phones the sign-up button follows along once the details and the list are out of view
  const detailsRef = useRef<HTMLDivElement>(null)
  const signupsRef = useRef<HTMLDivElement>(null)
  const [isSignupInView, setIsSignupInView] = useState(true)
  const hasSelectedTarget = !!selectedTarget
  useEffect(() => {
    if (!hasSelectedTarget) return
    const visible = new Set<Element>()
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      })
      setIsSignupInView(visible.size > 0)
    })
    ;[detailsRef.current, signupsRef.current].forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [hasSelectedTarget])

  const isSelectedOpen =
    !!now && !!selectedSummary && getSignupStatus(selectedSummary, now) === 'open'
  const showStickyBar = isSelectedOpen && !isSignupInView && !isDialogOpen
  const selectedFill = selectedSummary && totalFill(selectedSummary.pools, selectedSummary.counts)

  return (
    <PageWrapper>
      <Head>
        <title>{`${event.name} - Aalto Gamers`}</title>
      </Head>
      <Header className="mt-20 md:mt-10">{event.name}</Header>
      {showSignUp && (
        <CmsEditLink
          cmsPath={`collections/event/entries/${event.slug}`}
          label="Edit event"
          className="mt-4"
        >
          {adminSignupKey && (
            <AdminLinkButton
              href={`/admin/signups?event=${encodeURIComponent(adminSignupKey)}`}
              label="Edit sign-up"
            />
          )}
        </CmsEditLink>
      )}
      <div className="flex flex-col items-center">
        {/* On wide screens the details are a sidebar, so the description starts right under the image */}
        <div className="pt-8 pb-16 w-full md:w-3/4 grid gap-8 md:grid-cols-[minmax(0,1fr)_18rem] md:grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,1fr)_20rem] md:gap-x-10 md:items-start">
          <AGImage
            src={event.image}
            alt={event.name}
            className="max-h-[500px] md:max-h-[380px] w-full object-scale-down aspect-square md:col-start-1 md:row-start-1"
          />
          <div className="md:col-start-2 md:row-start-1 md:row-span-2" ref={detailsRef}>
            <EventDetails
              event={event}
              summaries={summaries}
              onSignUp={openDialog}
              isSignedUp={isSignedUp}
            />
          </div>
          <div className="min-w-0 md:col-start-1 md:row-start-2">
            {event.albumID && (
              <div className="mb-8 flex justify-center w-full">
                <Link
                  href={`${LYCHEE_BASE_URL}/gallery/${event.albumID}`}
                  className="borderbutton "
                >
                  View photos from this event
                </Link>
              </div>
            )}
            {/* The long description is optional; fall back to the short one */}
            <Markdown>{event.content.trim() ? event.content : event.description}</Markdown>
            <Markdown>All AG events follow the [AG Safer Space Policy](/safespace).</Markdown>
            {selectedTarget && selectedSummary && (
              <div id="signups" className="scroll-mt-24 mt-12 flex flex-col gap-6" ref={signupsRef}>
                <div>
                  <h2>Signups</h2>
                  {selectedTarget.session && (
                    <h5 className="text-lightgray mt-1">
                      {selectedTarget.session.name ? `${selectedTarget.session.name} · ` : ''}
                      {formatSessionTime(selectedTarget.session)}
                    </h5>
                  )}
                </div>
                {targets.length > 1 && (
                  <div role="tablist" className="flex flex-wrap gap-2">
                    {/* Furthest in the future first */}
                    {[...targets].reverse().map((target) => {
                      const isSelected = target.key === selectedTargetKey
                      return (
                        <button
                          key={target.key}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => setSelectedKey(target.key)}
                          className={`px-4 py-2 bg-darkgray border-b-4 text-base transition-colors ${
                            isSelected
                              ? 'border-red'
                              : 'border-gray-600 text-lightgray hover:border-lightgray'
                          }`}
                        >
                          {target.session
                            ? [
                                target.session.name,
                                eventMoment(target.session.start).format('ddd D.M.'),
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            : 'All dates'}
                        </button>
                      )
                    })}
                  </div>
                )}
                {currentList ? (
                  <ParticipantList
                    participants={currentList.participants}
                    pools={selectedSummary.pools}
                    inputs={selectedSummary.inputs}
                    ownSignupId={currentList.ownSignupId}
                  />
                ) : (
                  <div className="text-lightgray">Loading…</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showStickyBar && selectedTarget && selectedFill && (
        <>
          {/* Keeps the bar from covering the end of the page */}
          <div className="h-20 md:hidden" />
          <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-darkgray border-t border-gray-600 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-4">
            <button
              type="button"
              className="flex-1 min-w-0 flex flex-col gap-1.5 text-left"
              onClick={scrollToSignups}
            >
              <span className="text-base truncate">
                {selectedTarget.session
                  ? `${selectedTarget.session.name ? `${selectedTarget.session.name} · ` : ''}${eventMoment(selectedTarget.session.start).format('ddd D.M.')}`
                  : 'Sign-up open'}
                {selectedFill.size > 0 && (
                  <span className="text-lightgray">
                    {' '}
                    · {selectedFill.taken} / {selectedFill.size}
                  </span>
                )}
              </span>
              {selectedFill.size > 0 && (
                <CapacityBar taken={selectedFill.taken} size={selectedFill.size} compact />
              )}
            </button>
            <button
              type="button"
              className="mainbutton !text-lg !py-2 !px-6 shrink-0"
              onClick={() => setIsDialogOpen(true)}
            >
              {isSignedUp(selectedTarget.key) ? 'Edit' : 'Sign up'}
            </button>
          </div>
        </>
      )}

      {isDialogOpen && selectedTarget && selectedSummary && currentList && (
        <SignupDialog
          target={selectedTarget}
          summary={selectedSummary}
          participants={currentList.participants}
          ownSignupId={currentList.ownSignupId}
          onClose={() => setIsDialogOpen(false)}
          onChanged={refresh}
        />
      )}
    </PageWrapper>
  )
}

export default EventPage
