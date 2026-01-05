import type { NextApiRequest, NextApiResponse } from 'next'
import { EventAttributes, createEvents } from 'ics'
import { getFolder } from '../../utils/fileUtils'
import { AGEvent } from '../../types/types'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const events = getFolder('events') as AGEvent[]

    const icsEvents: EventAttributes[] = events
      .filter((event) => event.time)
      .map((event) => {
        return {
          uid: event.slug,
          start: event.time!,
          title: event.name,
          description: event.description,
          url: `https://aaltogamers.fi/events/${event.slug}`,
          status: 'CONFIRMED',
          organizer: { name: 'Aalto Gamers', email: 'board@aaltogamers.fi' },
          duration: { hours: event.duration },
        }
      })

    createEvents(icsEvents, (error, value) => {
      if (error) {
        console.error('Error creating ICS file:', error)
        return res.status(500).json({ error: 'Failed to generate calendar file' })
      }

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="aalto-gamers-events.ics"')

      return res.status(200).send(value)
    })
  } catch (error) {
    console.error('Error processing events:', error)
    return res.status(500).json({ error: 'Failed to process events' })
  }
}
