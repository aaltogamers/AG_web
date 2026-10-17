// Browser calls to the admin events API (/api/admin/events, /api/admin/media)
import type { StoredEvent } from './eventStore'
import { request } from './social/postsClient'

export const fetchEvents = () => request<{ events: StoredEvent[] }>('/api/admin/events')

export const createEvent = (data: Record<string, unknown>, body: string) =>
  request<{ event: StoredEvent }>('/api/admin/events', 'POST', { data, body })

// `version` is the version the editor loaded, so that changes made since aren't overwritten
export const updateEvent = (slug: string, version: number, data: Record<string, unknown>, body: string) =>
  request<{ event: StoredEvent; deletedSignupForms: string[] }>(
    `/api/admin/events/${encodeURIComponent(slug)}`,
    'PUT',
    { data, body, version }
  )

export const deleteEvent = (slug: string, version: number) =>
  request<object>(`/api/admin/events/${encodeURIComponent(slug)}?version=${version}`, 'DELETE')

// Returns the image's URL
export const uploadEventImage = async (file: File) => {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return request<{ url: string }>('/api/admin/media', 'POST', { data })
}
