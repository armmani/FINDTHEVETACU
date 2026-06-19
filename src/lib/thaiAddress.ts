import { provinces as rawData } from 'province'

type Row = {
  subdistrict_th: string
  district_th: string
  city_th: string
}

const data = rawData as Row[]

export function getProvinces(): string[] {
  return Array.from(new Set(data.map(r => r.city_th))).sort()
}

export function getDistricts(province: string): string[] {
  return Array.from(new Set(
    data.filter(r => r.city_th === province).map(r => r.district_th)
  )).sort()
}

export function getSubDistricts(province: string, district: string): string[] {
  return Array.from(new Set(
    data.filter(r => r.city_th === province && r.district_th === district).map(r => r.subdistrict_th)
  )).sort()
}
