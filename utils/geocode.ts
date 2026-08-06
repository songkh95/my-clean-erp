/** 주소 → 좌표 브라우저 캐시 */

export type GeocodePoint = { lat: number; lng: number }

const CACHE_KEY = 'my-clean-erp-geocode-v1'

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

export function getCachedGeocode(address: string): GeocodePoint | null {
  const key = normalizeAddress(address)
  if (!key) return null
  const hit = loadCache()[key]
  if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) return null
  return hit
}

export function setCachedGeocode(address: string, point: GeocodePoint) {
  const key = normalizeAddress(address)
  if (!key) return
  const cache = loadCache()
  cache[key] = point
  saveCache(cache)
}

export async function geocodeAddress(address: string): Promise<GeocodePoint | null> {
  const key = normalizeAddress(address)
  if (!key) return null
  const cached = getCachedGeocode(key)
  if (cached) return cached

  const res = await fetch(`/api/geocode?q=${encodeURIComponent(key)}`)
  if (!res.ok) return null
  const data = await res.json()
  if (!Number.isFinite(data?.lat) || !Number.isFinite(data?.lng)) return null
  const point = { lat: Number(data.lat), lng: Number(data.lng) }
  setCachedGeocode(key, point)
  return point
}

/** 순차 지오코딩 (레이트 리밋 완화) */
export async function geocodeMany(
  addresses: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, GeocodePoint>> {
  const unique = [...new Set(addresses.map(normalizeAddress).filter(Boolean))]
  const result = new Map<string, GeocodePoint>()
  let done = 0
  for (const addr of unique) {
    const point = await geocodeAddress(addr)
    if (point) result.set(addr, point)
    done += 1
    onProgress?.(done, unique.length)
    // Nominatim 권장 간격
    await new Promise((r) => setTimeout(r, 1100))
  }
  return result
}
