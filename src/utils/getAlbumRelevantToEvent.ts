import { AGEvent, LycheeAlbum } from '../types/types'
import { distance, closest } from 'fastest-levenshtein'

/**
 * Overly complicated logic, but works reasonably well to link events to their photo albums.
 * Modifies the events in place to add albumID where a relevant album is found.
 */
export const getRelevantAlbumsForEvents = (events: AGEvent[], albums: LycheeAlbum[]) => {
  const parsedAlbums = albums.map((album) => ({
    album,
    year: album.timeline.time_date,
    parsedTitle: album.title
      .toLowerCase()
      .replace(/ag /gi, '')
      .replace(/tournament /gi, '')
      .replace(/\b(20\d{2})\b/, ''),
  }))

  events.forEach((event) => {
    const eventName = event.name
      .toLowerCase()
      .replace('ag', '')
      .replace('tournament', '')
      .replace(/\b(20\d{2})\b/, '') // year, e.g. 2021

    const eventYear = event.time ? new Date(event.time).getFullYear().toString() : null

    if (!eventYear) {
      return
    }

    const albumNamesForYear = parsedAlbums
      .filter((pa) => pa.year === eventYear)
      .map((pa) => pa.parsedTitle)

    const closestAlbumName = closest(eventName, albumNamesForYear) || ''
    const nameDistance = distance(eventName, closestAlbumName)

    // If the closest album name is very different from the event name, skip linking
    if (nameDistance > closestAlbumName.length / 3) {
      return
    }

    const linkedAlbum = parsedAlbums.find((pa) => {
      return pa.parsedTitle === closestAlbumName
    })

    if (linkedAlbum) {
      event.albumID = linkedAlbum.album.id
    }
  })
}
