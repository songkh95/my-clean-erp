'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase'
import { geocodeAddress, getCachedGeocode, type GeocodePoint } from '@/utils/geocode'
import styles from '@/app/home.module.css'

type ClientPin = {
  id: string
  name: string
  address: string
  point: GeocodePoint
}

type ClientRow = {
  id: string
  name: string | null
  address: string | null
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function ClientsMap() {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [message, setMessage] = useState('거래처 위치를 불러오는 중...')
  const [pins, setPins] = useState<ClientPin[]>([])
  const [failed, setFailed] = useState(0)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    let cancelled = false

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

        const { data, error } = await supabase
          .from('clients')
          .select('id, name, address')
          .eq('organization_id', orgId)
          .eq('is_deleted', false)
          .not('address', 'is', null)
          .order('name', { ascending: true })

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

        const nextPins: ClientPin[] = []
        let miss = 0
        setProgress({ done: 0, total: rows.length })

        for (let i = 0; i < rows.length; i++) {
          if (cancelled) return
          const row = rows[i]
          const address = row.address!.trim()
          const cached = getCachedGeocode(address)
          const point = cached || (await geocodeAddress(address))
          if (point) {
            nextPins.push({
              id: row.id,
              name: row.name || '거래처',
              address,
              point,
            })
          } else {
            miss += 1
          }
          if (!cancelled) setProgress({ done: i + 1, total: rows.length })
          if (!cached) {
            await new Promise((r) => setTimeout(r, 1100))
          }
        }

        if (cancelled) return

        setPins(nextPins)
        setFailed(miss)
        if (nextPins.length === 0) {
          setStatus('empty')
          setMessage('주소를 지도 좌표로 변환하지 못했습니다. 주소를 확인해 주세요.')
        } else {
          setStatus('ready')
          setMessage('')
        }
        setProgress(null)
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
    let map: import('leaflet').Map | null = null

    const init = async () => {
      const L = (await import('leaflet')).default
      // CSS는 한 번만
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      if (cancelled || !mapEl.current) return

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      map = L.map(mapEl.current, {
        scrollWheelZoom: true,
        zoomControl: true,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const bounds = L.latLngBounds([])
      const markers: import('leaflet').Layer[] = []

      for (const pin of pins) {
        const icon = L.divIcon({
          className: styles.mapPinIcon,
          html: `
            <div class="${styles.mapPin}">
              <div class="${styles.mapPinMarker}" title="${escapeHtml(pin.address)}"></div>
              <div class="${styles.mapPinLabel}">${escapeHtml(pin.name)}</div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 28],
        })

        const marker = L.marker([pin.point.lat, pin.point.lng], { icon })
          .bindPopup(
            `<strong>${escapeHtml(pin.name)}</strong><br/><span style="color:#666;font-size:12px">${escapeHtml(pin.address)}</span>`
          )
          .addTo(map)
        markers.push(marker)
        bounds.extend([pin.point.lat, pin.point.lng])
      }

      if (pins.length === 1) {
        map.setView([pins[0].point.lat, pins[0].point.lng], 15)
      } else if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2))
      } else {
        map.setView([37.5665, 126.978], 11)
      }

      // 레이아웃 안정화 후 리사이즈
      setTimeout(() => map?.invalidateSize(), 100)
    }

    init()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [status, pins])

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
            {progress ? ` (${progress.done}/${progress.total})` : ''}
          </div>
        )}
        {status === 'empty' && <div className={styles.mapStatus}>{message}</div>}
        {status === 'error' && <div className={styles.mapStatus}>{message}</div>}
        {status === 'ready' && (
          <>
            <div ref={mapEl} className={styles.mapCanvas} />
            <div className={styles.mapFooter}>
              표시 {pins.length}곳
              {failed > 0 ? ` · 위치 변환 실패 ${failed}곳` : ''}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
