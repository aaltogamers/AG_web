import { createEvents } from 'ics'
import moment from 'moment-timezone' // Import moment-timezone
import { getEvents } from '../../utils/fileUtils'
import { convertEventsToCalendarFormat } from '../../utils/eventUtils'

export const dynamic = 'force-static'
export const revalidate = false

export async function GET() {
  try {
    const events = getEvents()
    const calendarEvents = convertEventsToCalendarFormat(events)

    const icsEvents = calendarEvents.map((event) => {
      const toIcsTime = (date: Date): [number, number, number, number, number] => {
        const utc = moment.utc(date)
        return [utc.year(), utc.month() + 1, utc.date(), utc.hour(), utc.minute()]
      }

      return {
        uid: event.id,
        start: toIcsTime(event.start),
        end: toIcsTime(event.end),
        startInputType: 'utc' as const,
        startOutputType: 'utc' as const,
        endInputType: 'utc' as const,
        endOutputType: 'utc' as const,
        title: event.title,
        description: event.description,
        url: event.url,
        location: event.location,
        status: 'CONFIRMED' as const,
        organizer: { name: 'Aalto Gamers', email: 'board@aaltogamers.fi' },
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
