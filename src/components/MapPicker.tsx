'use client'

import { useEffect, useRef } from 'react'

interface MapPickerProps {
  lat: number
  lng: number
  onMove?: (lat: number, lng: number) => void
  readonly?: boolean
}

export default function MapPicker({ lat, lng, onMove, readonly = false }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    // ป้องกัน Leaflet init ซ้ำ (React StrictMode double-mount)
    if ((containerRef.current as any)._leaflet_id) return

    import('leaflet').then(L => {
      // แก้ปัญหา icon หาย default ของ Leaflet ใน Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current!).setView([lat, lng], 15)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)

      const marker = L.marker([lat, lng], { draggable: !readonly }).addTo(map)
      markerRef.current = marker

      if (!readonly && onMove) {
        // ลาก pin เพื่อปรับพิกัด
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onMove(pos.lat, pos.lng)
        })
        // คลิกบน map เพื่อย้าย pin ไปตำแหน่งใหม่
        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng)
          onMove(e.latlng.lat, e.latlng.lng)
        })
      }
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // อัปเดตตำแหน่ง marker เมื่อ lat/lng เปลี่ยน (เช่น หลังกด "ค้นหา")
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    markerRef.current.setLatLng([lat, lng])
    mapRef.current.setView([lat, lng], 15)
  }, [lat, lng])

  return (
    <>
      {/* โหลด Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div
        ref={containerRef}
        style={{ height: '200px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}
      />
    </>
  )
}
