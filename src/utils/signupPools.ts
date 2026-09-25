import type { SignupPool } from '../types/types'

export const DEFAULT_POOL_NAME = 'Participants'

export const defaultPools = (): SignupPool[] => [{ id: 1, name: DEFAULT_POOL_NAME, size: 0 }]

// Clean up pools coming from the admin form or the database: trims names,
// coerces sizes, keeps given ids and assigns max+1 to new ones. Always
// returns at least one pool.
export const normalizePools = (raw: unknown): SignupPool[] => {
  if (!Array.isArray(raw) || raw.length === 0) return defaultPools()
  let maxId = 0
  raw.forEach((p) => {
    const id = Number(p?.id)
    if (Number.isFinite(id) && id > maxId) maxId = id
  })
  const usedIds = new Set<number>()
  return raw.map((p) => {
    let id = Number(p?.id)
    if (!Number.isFinite(id) || id <= 0 || usedIds.has(id)) {
      maxId += 1
      id = maxId
    }
    usedIds.add(id)
    const size = Math.max(0, parseInt(String(p?.size), 10) || 0)
    const name = String(p?.name ?? '').trim() || DEFAULT_POOL_NAME
    if (p?.private) {
      return { id, name, size, private: true, password: String(p?.password ?? '').trim() }
    }
    return { id, name, size }
  })
}

// Pools as shown to non-admins, without passwords
export const publicPools = (pools: SignupPool[]): SignupPool[] =>
  pools.map((p) => {
    const rest = { ...p }
    delete rest.password
    return rest
  })

// Passwords aren't meant to be very secret, so they're compared case-insensitively
export const isPoolPasswordValid = (pool: SignupPool, given: unknown): boolean =>
  !pool.private ||
  String(given ?? '')
    .trim()
    .toLowerCase() === (pool.password ?? '').toLowerCase()

// Sign-ups whose pool has been removed fall back to the first pool.
export const resolvePoolId = (pools: SignupPool[], poolId: number): number =>
  pools.some((p) => p.id === poolId) ? poolId : pools[0].id

// With a single pool the choice is implicit; otherwise it must match a pool.
export const pickPoolId = (pools: SignupPool[], requested: unknown): number | null => {
  if (pools.length === 1) return pools[0].id
  const id = Number(requested)
  return pools.some((p) => p.id === id) ? id : null
}

// Sign-ups beyond a pool's size go to its reserve list
export const poolFill = (pool: SignupPool, count: number) => ({
  taken: Math.min(count, pool.size),
  reserve: Math.max(0, count - pool.size),
  isFull: count >= pool.size,
})

// Places and sign-ups over all pools, for showing a sign-up's fill as one bar
export const totalFill = (pools: SignupPool[], counts: Record<number, number>) =>
  pools.reduce(
    (total, pool) => {
      const { taken, reserve, isFull } = poolFill(pool, counts[pool.id] ?? 0)
      return {
        taken: total.taken + taken,
        size: total.size + pool.size,
        reserve: total.reserve + reserve,
        isFull: total.isFull && isFull,
      }
    },
    { taken: 0, size: 0, reserve: 0, isFull: true }
  )
