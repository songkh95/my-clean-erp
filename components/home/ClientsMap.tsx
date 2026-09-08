'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase'
import { saveClientMapCoordsAction } from '@/app/actions/client'
import { geocodeMany, getCachedGeocodeMap, setCachedGeocodeMany, type GeocodePoint } from '@/utils/geocode'
import styles from '@/app/home.module.css'

type ClientPin = {
  id: string
  name: string
  address: string
  addressDetail: string
  point: GeocodePoint
}

type ClientRow = {
  id: string
  name: string | null
  address: string | null
  address_detail: string | null
  map_lat: number | null
  map_lng: number | null
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isValidPoint(lat: unknown, lng: unknown): GeocodePoint | null {
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a < 33 || a > 39 || b < 124 || b > 132) return null
  return { lat: a, lng: b }
}

export default function ClientsMap() {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersRef = useRef<import('leaflet').Layer[]>([])
  const pinIdsRef = useRef<Set<string>>(new Set())
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [message, setMessage] = useState('거래처 위치를 불러오는 중...')
  const [pins, setPins] = useState<ClientPin[]>([])
  const [failed, setFailed] = useState(0)
  const [progress, setProgress] = useState<{ done: number; total: number; found: number } | null>(null)

  useEffect(() => {
    let cancelled = false

    const pinsFrom = (
      rows: { row: ClientRow; address: string }[],
      points: Map<string, GeocodePoint>
    ) => {
      const next: ClientPin[] = []
      for (const { row, address } of rows) {
        const key = address.replace(/\s+/g, ' ')
        const point = points.get(key) || points.get(address)
        if (!point) continue
        next.push({
          id: row.id,
          name: row.name || '거래처',
          address,
          addressDetail: String(row.address_detail || '').trim(),
          point,
        })
      }
      return next
    }

    const run = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single()

        const orgId = profile?.organization_id
        if (!orgId) {
          if (!cancelled) {
            setStatus('empty')
            setMessage('소속 조직 정보가 없습니다.')
          }
          return
        }

        let { data, error } = await supabase
          .from('clients')
          .select('id, name, address, address_detail, map_lat, map_lng')
          .eq('organization_id', orgId)
          .eq('is_deleted', false)
          .not('address', 'is', null)
          .order('name', { ascending: true })

        // map_lat 컬럼 미적용 환경 호환
        if (error && /map_lat|map_lng|schema cache/i.test(error.message)) {
          const retry = await supabase
            .from('clients')
            .select('id, name, address, address_detail')
            .eq('organization_id', orgId)
            .eq('is_deleted', false)
            .not('address', 'is', null)
            .order('name', { ascending: true })
          data = (retry.data || []).map((r: any) => ({ ...r, map_lat: null, map_lng: null }))
          error = retry.error
        }

        if (error) throw error

        const rows = ((data || []) as ClientRow[]).filter(
          (c) => c.address && c.address.trim() && c.name
        )

        if (rows.length === 0) {
          if (!cancelled) {
            setStatus('empty')
            setMessage('주소가 등록된 거래처가 없습니다.')
          }
          return
        }

        const cache = getCachedGeocodeMap()
        const readyPins: ClientPin[] = []
        const missing: { row: ClientRow; address: string }[] = []
        const toPersist: { id: string; lat: number; lng: number }[] = []

        for (const row of rows) {
          const address = row.address!.trim()
          const key = address.replace(/\s+/g, ' ')
          const fromDb = isValidPoint(row.map_lat, row.map_lng)
          const fromCache = isValidPoint(cache[key]?.lat, cache[key]?.lng)
          const point = fromDb || fromCache
          if (point) {
            readyPins.push({
              id: row.id,
              name: row.name || '거래처',
              address,
              addressDetail: String(row.address_detail || '').trim(),
              point,
            })
            if (!fromDb) toPersist.push({ id: row.id, lat: point.lat, lng: point.lng })
            if (fromDb && !fromCache) {
              setCachedGeocodeMany([[key, point]])
            }
          } else {
            missing.push({ row, address })
          }
        }

        const applyPins = (
          found: ClientPin[],
          opts?: { processed?: number; total?: number; finished?: boolean }
        ) => {
          if (cancelled) return
          setPins(found)
          setFailed(Math.max(0, rows.length - found.length))
          if (found.length > 0) {
            setStatus('ready')
            setMessage('')
          }
          const total = opts?.total ?? rows.length
          const processed = opts?.processed
          if (opts?.finished) {
            setProgress(null)
          } else if (processed != null) {
            setProgress({ done: processed, total, found: found.length })
          }
        }

        if (readyPins.length > 0) {
          applyPins(readyPins, {
            processed: readyPins.length,
            total: rows.length,
            finished: missing.length === 0,
          })
        }

        if (toPersist.length > 0) {
          saveClientMapCoordsAction(toPersist).catch(() => {})
        }

        if (missing.length === 0) {
          applyPins(readyPins, { finished: true })
          return
        }

        if (readyPins.length === 0 && !cancelled) {
          setMessage(`거래처 ${rows.length}곳 위치를 불러오는 중... (첫 변환은 수 분 걸릴 수 있어요)`)
          setProgress({ done: 0, total: rows.length, found: 0 })
        }

        const points = await geocodeMany(
          missing.map((m) => m.address),
          (done, total, found) => {
            if (cancelled) return
            const merged = [...readyPins, ...pinsFrom(missing, found)]
            const seen = new Set<string>()
            const uniquePins = merged.filter((p) => {
              if (seen.has(p.id)) return false
              seen.add(p.id)
              return true
            })
            // done = 지오코딩 처리 건수(캐시 포함), 핀과 별도로 게이지 진행
            const processed = readyPins.length + done
            applyPins(uniquePins, {
              processed: Math.min(processed, rows.length),
              total: rows.length,
            })
            if (uniquePins.length === 0 && !cancelled) {
              setMessage(`거래처 ${rows.length}곳 위치를 불러오는 중...`)
            }
          }
        )
        if (cancelled) return

        const nextPins = [...readyPins, ...pinsFrom(missing, points)]
        const seen = new Set<string>()
        const uniquePins = nextPins.filter((p) => {
          if (seen.has(p.id)) return false
          seen.add(p.id)
          return true
        })
        applyPins(uniquePins, { finished: true })

        const newlyFound = pinsFrom(missing, points).map((p) => ({
          id: p.id,
          lat: p.point.lat,
          lng: p.point.lng,
        }))
        if (newlyFound.length > 0) {
          saveClientMapCoordsAction(newlyFound).catch(() => {})
        }

        if (uniquePins.length === 0) {
          setStatus('empty')
          setMessage('주소를 지도 좌표로 변환하지 못했습니다. 주소를 확인해 주세요.')
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setStatus('error')
          setMessage('지도 데이터를 불러오지 못했습니다.')
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready' || pins.length === 0 || !mapEl.current) return

    let cancelled = false

    const sync = async () => {
      const L = (await import('leaflet')).default
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      if (cancelled || !mapEl.current) return

      let map = mapRef.current
      if (!map) {
        map = L.map(mapEl.current, {
          scrollWheelZoom: true,
          zoomControl: true,
        })
        mapRef.current = map
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map)
      }

      const bounds = L.latLngBounds([])
      let added = 0
      for (const pin of pins) {
        bounds.extend([pin.point.lat, pin.point.lng])
        if (pinIdsRef.current.has(pin.id)) continue
        pinIdsRef.current.add(pin.id)
        added += 1
        const fullAddress = [pin.address, pin.addressDetail].filter(Boolean).join(' ')
        const icon = L.divIcon({
          className: styles.mapPinIcon,
          html: `
            <div class="${styles.mapPin}">
              <div class="${styles.mapPinMarker}" title="${escapeHtml(fullAddress)}"></div>
              <div class="${styles.mapPinLabel}">${escapeHtml(pin.name)}</div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 28],
        })
        const marker = L.marker([pin.point.lat, pin.point.lng], { icon })
          .bindPopup(
            `<strong>${escapeHtml(pin.name)}</strong><br/><span style="color:#666;font-size:12px">${escapeHtml(fullAddress)}</span>`
          )
          .addTo(map)
        markersRef.current.push(marker)
      }

      if (pins.length === 1) {
        map.setView([pins[0].point.lat, pins[0].point.lng], 15)
      } else if (bounds.isValid() && (added > 0 || markersRef.current.length === pins.length)) {
        map.fitBounds(bounds.pad(0.2))
      }

      setTimeout(() => map?.invalidateSize(), 100)
    }

    sync()
    return () => {
      cancelled = true
    }
  }, [status, pins])

  useEffect(() => {
    return () => {
      markersRef.current = []
      pinIdsRef.current.clear()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>거래처 지도</h2>
        <Link href="/clients" className={styles.sectionMore}>
          거래처 관리
        </Link>
      </div>
      <div className={`${styles.panel} ${styles.mapPanel}`}>
        {status === 'loading' && (
          <div className={styles.mapStatus}>
            {message}
            {progress
              ? ` (${progress.done}/${progress.total}${progress.found > 0 ? `, 표시 ${progress.found}` : ''})`
              : ''}
          </div>
        )}
        {status === 'empty' && <div className={styles.mapStatus}>{message}</div>}
        {status === 'error' && <div className={styles.mapStatus}>{message}</div>}
        {status === 'ready' && (
          <>
            <div ref={mapEl} className={styles.mapCanvas} />
            <div className={styles.mapFooter}>
              표시 {pins.length}곳
              {progress
                ? ` · 변환 중 ${progress.done}/${progress.total}`
                : failed > 0
                  ? ` · 주소 확인 필요 ${failed}곳`
                  : ''}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
