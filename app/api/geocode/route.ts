import { NextRequest, NextResponse } from 'next/server'
import { koreanAddressQueries, bestStreetQuery } from '@/utils/koreanAddress'

export const maxDuration = 60

type GeocodeResult = { lat: number; lng: number; source: string }

const mem = new Map<string, GeocodeResult>()
const MAX_BATCH = 250

/** Photon이 연속 실패하면 잠시 건너뜀 (한국 망에서 타임아웃 잦음) */
let photonSkipUntil = 0

function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, ' ')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function pool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  if (items.length === 0) return
  let i = 0
  async function run() {
    while (i < items.length) {
      const item = items[i++]
      await worker(item)
    }
  }
  const n = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: n }, () => run()))
}

function parseKakaoDoc(doc: { x?: string; y?: string } | undefined, source: string): GeocodeResult | null {
  if (!doc?.x || !doc?.y) return null
  const lat = Number(doc.y)
  const lng = Number(doc.x)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, source }
}

async function kakaoFetch(url: string, key: string): Promise<any | null> {
  const headers = { Authorization: `KakaoAK ${key}` }
  try {
    let res = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (res.status === 429) {
      await sleep(300)
      res = await fetch(url, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      })
    }
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function geocodeKakao(query: string, key: string): Promise<GeocodeResult | null> {
  const addrUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`
  const addrData = await kakaoFetch(addrUrl, key)
  const addrHit = parseKakaoDoc(addrData?.documents?.[0], 'kakao')
  if (addrHit) return addrHit

  const keywordUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`
  const keywordData = await kakaoFetch(keywordUrl, key)
  return parseKakaoDoc(keywordData?.documents?.[0], 'kakao-keyword')
}

async function geocodePhoton(query: string): Promise<GeocodeResult | null> {
  if (Date.now() < photonSkipUntil) return null

  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
    `&limit=5&lang=ko&lat=36.5&lon=127.8`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MyCleanERP/1.0 (dashboard client map)',
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) {
      photonSkipUntil = Date.now() + 10 * 60 * 1000
      return null
    }
    const data = await res.json()
    const features = Array.isArray(data?.features) ? data.features : []
    for (const f of features) {
      const props = f?.properties || {}
      const country = String(props.countrycode || props.country || '').toUpperCase()
      if (
        country &&
        country !== 'KR' &&
        !String(props.country || '').includes('한국') &&
        !String(props.country || '').includes('Korea')
      ) {
        continue
      }
      const coords = f?.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) continue
      const lng = Number(coords[0])
      const lat = Number(coords[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      if (lat < 33 || lat > 39 || lng < 124 || lng > 132) continue
      return { lat, lng, source: 'photon' }
    }
  } catch {
    // 타임아웃/네트워크 → 10분간 Photon 생략 (Nominatim으로)
    photonSkipUntil = Date.now() + 10 * 60 * 1000
    return null
  }
  return null
}

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=` +
    encodeURIComponent(query)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MyCleanERP/1.0 (dashboard client map)',
        'Accept-Language': 'ko',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (res.status === 429) {
      await sleep(2000)
      return null
    }
    if (!res.ok) return null
    const data = await res.json()
    const hit = Array.isArray(data) ? data[0] : null
    if (!hit?.lat || !hit?.lon) return null
    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (lat < 33 || lat > 39 || lng < 124 || lng > 132) return null
    return { lat, lng, source: 'nominatim' }
  } catch {
    return null
  }
}

function remember(original: string, q: string, hit: GeocodeResult) {
  mem.set(original, hit)
  mem.set(q, hit)
  return hit
}

function queryVariants(original: string, max: number) {
  const variants = koreanAddressQueries(original)
  const street = bestStreetQuery(original)
  return [...new Set([street, ...variants].filter(Boolean))].slice(0, max)
}

async function geocodeBest(
  original: string,
  kakaoKey?: string,
  opts?: { fast?: boolean }
): Promise<GeocodeResult | null> {
  const cached = mem.get(original)
  if (cached) return cached

  const fast = Boolean(opts?.fast)
  const ordered = queryVariants(original, fast ? 2 : 4)

  if (kakaoKey) {
    for (const q of ordered) {
      const hit = mem.get(q) || (await geocodeKakao(q, kakaoKey))
      if (hit) return remember(original, q, hit)
    }
  }

  // Photon은 되면 빠르지만, 실패 시 회로차단으로 바로 Nominatim
  if (Date.now() >= photonSkipUntil) {
    for (const q of ordered.slice(0, 1)) {
      const hit = mem.get(q) || (await geocodePhoton(q))
      if (hit) return remember(original, q, hit)
    }
  }

  for (const q of ordered.slice(0, fast ? 1 : 2)) {
    const hit = mem.get(q) || (await geocodeNominatim(q))
    if (hit) return remember(original, q, hit)
  }

  return null
}

export async function GET(req: NextRequest) {
  const q = normalizeQuery(req.nextUrl.searchParams.get('q') || '')
  if (!q) {
    return NextResponse.json({ error: 'q required' }, { status: 400 })
  }

  try {
    const kakaoKey = process.env.KAKAO_REST_API_KEY
    const result = await geocodeBest(q, kakaoKey, { fast: false })
    if (!result) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (e) {
    console.error('geocode failed', e)
    return NextResponse.json({ error: 'geocode_failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let queries: unknown[] = []
  try {
    const body = await req.json()
    queries = Array.isArray(body?.queries) ? body.queries : []
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const unique = [
    ...new Set(
      queries
        .map((q) => normalizeQuery(String(q || '')))
        .filter((q) => q.length > 0 && q.length <= 300)
    ),
  ].slice(0, MAX_BATCH)

  const kakaoKey = process.env.KAKAO_REST_API_KEY
  const results: Record<string, GeocodeResult> = {}

  try {
    if (kakaoKey) {
      await pool(unique, 6, async (q) => {
        const result = await geocodeBest(q, kakaoKey, { fast: true })
        if (result) results[q] = result
      })
    } else {
      // Nominatim 정책: 초당 1건. 병렬 금지.
      for (let i = 0; i < unique.length; i++) {
        const q = unique[i]
        const result = await geocodeBest(q, undefined, { fast: true })
        if (result) results[q] = result
        if (i < unique.length - 1) await sleep(1100)
      }
    }

    return NextResponse.json({ results })
  } catch (e) {
    console.error('geocode batch failed', e)
    return NextResponse.json({ error: 'geocode_failed' }, { status: 500 })
  }
}
