const entries = new Map()

export async function cached(key, loader, ttlMs = 60_000) {
  const now = Date.now()

  const hit = entries.get(key)

  if (hit && hit.expiresAt > now)
    return { value: hit.value, cached: true, fetchedAt: hit.fetchedAt }

  const value = await loader()

  entries.set(key, {
    value,
    expiresAt: now + ttlMs,
    fetchedAt: new Date(now).toISOString(),
  })

  return { value, cached: false, fetchedAt: new Date(now).toISOString() }
}

export function clearCache() {
  entries.clear()
}
