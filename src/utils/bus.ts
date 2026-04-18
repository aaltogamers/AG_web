import { EventEmitter } from 'events'

// Shared in-process event bus. Used to fan out DB mutations to SSE subscribers.
// Kept on globalThis so Next.js dev HMR doesn't create multiple instances.
const globalForBus = globalThis as unknown as { __agBus?: EventEmitter }

export type BusTopic = 'mapbans' | 'polls' | 'votes'

const getBus = (): EventEmitter => {
  if (!globalForBus.__agBus) {
    const bus = new EventEmitter()
    // Allow plenty of concurrent SSE clients per topic.
    bus.setMaxListeners(0)
    globalForBus.__agBus = bus
  }
  return globalForBus.__agBus
}

export const publish = (topic: BusTopic): void => {
  getBus().emit(topic)
}

export const subscribe = (topic: BusTopic, handler: () => void): (() => void) => {
  const bus = getBus()
  bus.on(topic, handler)
  return () => {
    bus.off(topic, handler)
  }
}
