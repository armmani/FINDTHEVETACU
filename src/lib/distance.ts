'use client'

export interface DistanceResult {
  distanceKm: number
  durationText: string
}

// คำนวณระยะทางด้วย Haversine (เส้นตรง) — ไม่ต้องพึ่ง JS library
export function calculateDistanceSync(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): DistanceResult {
  return haversineDistance(lat1, lng1, lat2, lng2)
}

// Async wrapper (ใช้ Haversine เสมอ — Distance Matrix ต้องการ billing)
export async function calculateDistance(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<DistanceResult> {
  return haversineDistance(originLat, originLng, destLat, destLng)
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): DistanceResult {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceKm = R * c
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationText: `~${Math.ceil((distanceKm / 40) * 60)} นาที`,
  }
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

// ====================================================
// Platform Fixed Rates (กำหนดโดย platform ป้องกันการตัดราคา)
// ====================================================
export const PLATFORM_ACUPUNCTURE_FEE = 1800
export const PLATFORM_BASE_FARE = 50
export const PLATFORM_RATE_PER_KM = 8
export const PLATFORM_RATE_LABEL = '50 บาท + 8 บาท/กม. × 2 (ไป-กลับ)'
export const PLATFORM_FEE_RATE = 0.05 // 5% หักเข้าระบบจากทุก transaction ที่ complete

export function calcPlatformFee(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_RATE)
}

export function calcTravelFee(distanceKm: number): number {
  const roundTrip = distanceKm * 2
  return Math.round(PLATFORM_BASE_FARE + PLATFORM_RATE_PER_KM * roundTrip)
}

// ====================================================
// Geocoding — แปลงที่อยู่ข้อความ → พิกัด lat/lng
// ใช้ Google Geocoding REST API (ไม่ต้องโหลด JS library)
// ====================================================
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return null

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=TH&key=${key}`
    )
    const data = await res.json()
    if (data.status === 'OK' && data.results[0]) {
      const loc = data.results[0].geometry.location
      return { lat: loc.lat, lng: loc.lng }
    }
  } catch {}
  return null
}
