import type { NextApiRequest, NextApiResponse } from 'next'
import { EventAttributes, createEvents } from 'ics'
import { getFolder } from '../../utils/fileUtils'
import { AGEvent } from '../../types/types'
import { convertEventsToCalendarFormat } from '../../utils/eventUtils'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const events = getFolder('events') as AGEvent[]
    const calendarEvents = convertEventsToCalendarFormat(events)

    const icsEvents: EventAttributes[] = calendarEvents.map((event) => {
      const startDate = event.start
      const start: [number, number, number, number, number] = [
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        startDate.getDate(),
        startDate.getHours(),
        startDate.getMinutes(),
      ]

      const duration = Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60))

      return {
        uid: event.id,
        start,
        title: event.title,
        description: event.description,
        url: event.url,
        status: 'CONFIRMED',
        organizer: { name: 'Aalto Gamers', email: 'board@aaltogamers.fi' },
        duration: { hours: duration },
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
