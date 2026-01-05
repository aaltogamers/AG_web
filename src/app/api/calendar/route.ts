import { createEvents } from 'ics'
import moment from 'moment-timezone' // Import moment-timezone
import { getFolder } from '../../../utils/fileUtils'
import { AGEvent } from '../../../types/types'
import { convertEventsToCalendarFormat } from '../../../utils/eventUtils'

export const dynamic = 'force-static'
export const revalidate = false

export async function GET() {
  try {
    const events = getFolder('events') as AGEvent[]
    const calendarEvents = convertEventsToCalendarFormat(events)

    const icsEvents = calendarEvents.map((event) => {
      const startMoment = moment.tz(event.start, 'Europe/Helsinki')

      const utcStart = startMoment.clone().utc()

      const start: [number, number, number, number, number] = [
        utcStart.year(),
        utcStart.month() + 1,
        utcStart.date(),
        utcStart.hour(),
        utcStart.minute(),
      ]

      return {
        uid: event.id,
        start,
        startInputType: 'utc' as const, // IMPORTANT: Set input to UTC
        startOutputType: 'utc' as const, // IMPORTANT: Set output to UTC
        title: event.title,
        description: event.description,
        url: event.url,
        status: 'CONFIRMED' as const,
        organizer: { name: 'Aalto Gamers', email: 'board@aaltogamers.fi' },
        duration: { hours: event.duration },
      }
    })

    return new Promise<Response>((resolve, reject) => {
      createEvents(icsEvents, (error, value) => {
        if (error) {
          console.error('Error creating ICS file:', error)
          reject(
            new Response(JSON.stringify({ error: 'Failed to generate calendar file' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }

        resolve(
          new Response(value, {
            status: 200,
            headers: {
              'Content-Type': 'text/calendar; charset=utf-8',
              'Content-Disposition': 'attachment; filename="aalto-gamers-events.ics"',
            },
          })
        )
      })
    })
  } catch (error) {
    console.error('Error processing events:', error)
    return new Response(JSON.stringify({ error: 'Failed to process events' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
