import { NextRequest, NextResponse } from 'next/server'

type GeocodeResult = { lat: number; lng: number; source: string }

async function geocodeKakao(query: string, key: string): Promise<GeocodeResult | null> {
  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null
  const data = await res.json()
  const doc = data?.documents?.[0]
  if (!doc?.y || !doc?.x) {
    // 주소 검색 실패 시 키워드 검색 시도
    const keywordUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`
    const kRes = await fetch(keywordUrl, {
      headers: { Authorization: `KakaoAK ${key}` },
      next: { revalidate: 86400 },
    })
    if (!kRes.ok) return null
    const kData = await kRes.json()
    const kDoc = kData?.documents?.[0]
    if (!kDoc?.y || !kDoc?.x) return null
    return { lat: Number(kDoc.y), lng: Number(kDoc.x), source: 'kakao-keyword' }
  }
  return { lat: Number(doc.y), lng: Number(doc.x), source: 'kakao' }
}

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=` +
    encodeURIComponent(query)
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'MyCleanERP/1.0 (dashboard client map)',
      'Accept-Language': 'ko',
    },
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null
  const data = await res.json()
  const hit = Array.isArray(data) ? data[0] : null
  if (!hit?.lat || !hit?.lon) return null
  return { lat: Number(hit.lat), lng: Number(hit.lon), source: 'nominatim' }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) {
    return NextResponse.json({ error: 'q required' }, { status: 400 })
  }

  try {
    const kakaoKey = process.env.KAKAO_REST_API_KEY
    let result: GeocodeResult | null = null
    if (kakaoKey) {
      result = await geocodeKakao(q, kakaoKey)
    }
    if (!result) {
      result = await geocodeNominatim(q)
    }
    if (!result) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (e) {
    console.error('geocode failed', e)
    return NextResponse.json({ error: 'geocode_failed' }, { status: 500 })
  }
}
