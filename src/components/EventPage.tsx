import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Header from './Header'
import CmsEditLink, { AdminLinkButton } from './CmsEditLink'
import Markdown from './Markdown'
import PageWrapper from './PageWrapper'
import AGImage from './AGImage'
import EventDetails from './EventDetails'
import SignUpForm from './SignupForm'
import { AGEvent } from '../types/types'
import { LYCHEE_BASE_URL } from '../utils/constants'
import { eventMoment, getSignupStatus, getSignupTargets } from '../utils/eventUtils'
import { getSignupEvent, SignupEvent } from '../utils/signupApi'
import { useNow } from '../utils/useNow'

type Props = {
  event: AGEvent
  // The CMS preview hides sign-ups so editors can't sign up by accident
  showSignUp?: boolean
}

const EventPage = ({ event, showSignUp = true }: Props) => {
  const now = useNow()
  const [signupForms, setSignupForms] = useState<Record<string, SignupEvent>>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Enabling sign-ups in the CMS does nothing until the form is created in the admin panel
  const targets = getSignupTargets(event).filter((t) => signupForms[t.key])
  const targetKeys = getSignupTargets(event)
    .map((t) => t.key)
    .join(',')

  useEffect(() => {
    setSelectedKey(null)
    setSignupForms({})
    if (!showSignUp || !targetKeys) return
    let cancelled = false
    Promise.all(
      targetKeys.split(',').map(async (key) => [key, await getSignupEvent(key)] as const)
    ).then((entries) => {
      if (cancelled) return
      setSignupForms(
        Object.fromEntries(entries.filter((entry): entry is [string, SignupEvent] => !!entry[1]))
      )
    })
    return () => {
      cancelled = true
    }
  }, [targetKeys, showSignUp])

  // Default to the first open sign-up, then the first one for an upcoming session
  const defaultTarget =
    (now &&
      (targets.find((t) => getSignupStatus(signupForms[t.key], now) === 'open') ??
        targets.find((t) => !t.session || eventMoment(t.session.end).isAfter(now)))) ||
    targets[0]
  const selectedTarget = targets.find((t) => t.key === selectedKey) ?? defaultTarget
  // Also link sign-ups that are enabled in the CMS but not yet created in the admin panel
  const adminSignupKey = selectedTarget?.key ?? targetKeys.split(',')[0]

  return (
    <PageWrapper>
      <Head>
        <title>{`${event.name} - Aalto Gamers`}</title>
      </Head>
      <Header>{event.name}</Header>
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
        <div className="py-16 md:w-3/4">
          <div className="flex flex-col md:flex-row justify-center">
            <AGImage
              src={event.image}
              alt={event.name}
              className="max-h-[500px] object-scale-down md:max-w-[50%] pb-8 aspect-square"
            />
            <div className="mt-8 md:mt-0 md:pl-8 md:min-w-80">
              <EventDetails
                event={event}
                signupForms={signupForms}
                selectedSignupKey={selectedTarget?.key ?? null}
                onSelectSignup={setSelectedKey}
              />
            </div>
          </div>
          {event.albumID && (
            <div className="mb-8 flex justify-center w-full">
              <Link href={`${LYCHEE_BASE_URL}/gallery/${event.albumID}`} className="borderbutton ">
                View photos from this event
              </Link>
            </div>
          )}
          {/* The long description is optional; fall back to the short one */}
          <Markdown>{event.content.trim() ? event.content : event.description}</Markdown>
          <Markdown>All AG events follow the [AG Safer Space Policy](/safespace).</Markdown>
          {selectedTarget && (
            <div id="signup-section" className="scroll-mt-24">
              <SignUpForm target={selectedTarget} signupEvent={signupForms[selectedTarget.key]} />
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

export default EventPage
