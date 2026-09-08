/** 주소 → 좌표 브라우저 캐시 */

export type GeocodePoint = { lat: number; lng: number }

const CACHE_KEY = 'my-clean-erp-geocode-v2'

type CacheMap = Record<string, GeocodePoint>

function loadCache(): CacheMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveCache(cache: CacheMap) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore quota */
  }
}

function normalizeAddress(address: string) {
  return address.trim().replace(/\s+/g, ' ')
}

function asPoint(value: unknown): GeocodePoint | null {
  const lat = Number((value as { lat?: unknown })?.lat)
  const lng = Number((value as { lng?: unknown })?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export function getCachedGeocodeMap(): CacheMap {
  return loadCache()
}

export function getCachedGeocode(address: string): GeocodePoint | null {
  const key = normalizeAddress(address)
  if (!key) return null
  return asPoint(loadCache()[key])
}

export function setCachedGeocode(address: string, point: GeocodePoint) {
  const key = normalizeAddress(address)
  if (!key) return
  const cache = loadCache()
  cache[key] = point
  saveCache(cache)
}

export function setCachedGeocodeMany(entries: Iterable<[string, GeocodePoint]>) {
  const cache = loadCache()
  let changed = false
  for (const [address, point] of entries) {
    const key = normalizeAddress(address)
    if (!key || !asPoint(point)) continue
    cache[key] = point
    changed = true
  }
  if (changed) saveCache(cache)
}

export async function geocodeAddress(address: string): Promise<GeocodePoint | null> {
  const key = normalizeAddress(address)
  if (!key) return null
  const cached = getCachedGeocode(key)
  if (cached) return cached

  const res = await fetch(`/api/geocode?q=${encodeURIComponent(key)}`)
  if (!res.ok) return null
  const data = await res.json()
  const point = asPoint(data)
  if (!point) return null
  setCachedGeocode(key, point)
  return point
}

async function fetchChunk(chunk: string[], timeoutMs: number): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: chunk }),
      signal: controller.signal,
    })
    if (!res.ok) return {}
    const data = await res.json()
    return (data?.results || {}) as Record<string, unknown>
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 작은 묶음으로 순차 변환. Nominatim(키 없음)은 묶음당 ~1초×건수라
 * 묶음을 작게 유지해야 진행률이 자주 갱신됨.
 */
export async function geocodeMany(
  addresses: string[],
  onProgress?: (done: number, total: number, found: Map<string, GeocodePoint>) => void
): Promise<Map<string, GeocodePoint>> {
  const unique = [...new Set(addresses.map(normalizeAddress).filter(Boolean))]
  const result = new Map<string, GeocodePoint>()
  const cache = loadCache()

  const missing: string[] = []
  for (const addr of unique) {
    const hit = asPoint(cache[addr])
    if (hit) result.set(addr, hit)
    else missing.push(addr)
  }

  const baseDone = unique.length - missing.length
  onProgress?.(baseDone, unique.length, result)
  if (missing.length === 0) return result

  // 3건씩: 서버에서 약 3~4초 → UI가 수 초마다 갱신
  const CHUNK = 3
  let processed = 0

  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK)
    // Nominatim 대기 포함해 여유 타임아웃
    const found = await fetchChunk(chunk, 20000 + chunk.length * 4000)
    const extras: [string, GeocodePoint][] = []

    for (const addr of chunk) {
      const point = asPoint(found[addr])
      if (!point) continue
      result.set(addr, point)
      extras.push([addr, point])
    }

    if (extras.length) setCachedGeocodeMany(extras)
    processed += chunk.length
    onProgress?.(baseDone + processed, unique.length, result)
  }

  return result
}
