'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Stethoscope, MapPin, ExternalLink, ShieldCheck, Search, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Slot {
  day: number
  start_time: string
  end_time: string
}

interface VetSchedule {
  id: string
  place_name: string
  sub_district: string | null
  district: string | null
  province: string
  slots: Slot[]
}

interface VetInfo {
  user_id: string
  bio: string | null
  license_number: string | null
  additional_education: string[]
  is_available: boolean
  location_name: string | null
  full_name: string
  avatar_url: string | null
  schedules: VetSchedule[]
}

const EDU_LABELS: Record<string, string> = {
  internship: 'Internship',
  certificate: 'Certificate',
  resident: 'Resident',
}

const VERIFY_URL = 'http://209.15.98.88/index.php?option=com_content&view=article&id=183'

export default function VetsPage() {
  const supabase = createClient()
  const [vets, setVets] = useState<VetInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [provinceFilter, setProvinceFilter] = useState('')

  useEffect(() => {
    const load = async () => {
      const [{ data: vetData }, { data: scheduleData }] = await Promise.all([
        supabase
          .from('vet_profiles')
          .select(`user_id, bio, license_number, additional_education, is_available, location_name, profiles!inner(full_name, avatar_url)`)
          .order('is_available', { ascending: false }),
        supabase.from('vet_schedules').select('*').order('created_at', { ascending: true }),
      ])

      const schedulesByVet: Record<string, VetSchedule[]> = {}
      for (const s of (scheduleData || [])) {
        if (!schedulesByVet[s.vet_id]) schedulesByVet[s.vet_id] = []
        schedulesByVet[s.vet_id].push(s as VetSchedule)
      }

      const mapped = (vetData || []).map((v: any) => ({
        ...v,
        full_name: v.profiles?.full_name || '',
        avatar_url: v.profiles?.avatar_url || null,
        schedules: schedulesByVet[v.user_id] || [],
      }))
      setVets(mapped)
      setLoading(false)
    }
    load()
  }, [])

  const allProvinces = Array.from(new Set(
    vets.flatMap(v => v.schedules.map(s => s.province))
  )).sort()

  const filtered = vets.filter(v => {
    const search = searchText.toLowerCase().trim()
    const matchSearch = !search ||
      v.full_name.toLowerCase().includes(search) ||
      v.location_name?.toLowerCase().includes(search) ||
      v.schedules.some(s =>
        s.province.toLowerCase().includes(search) ||
        s.district?.toLowerCase().includes(search) ||
        s.sub_district?.toLowerCase().includes(search) ||
        s.place_name.toLowerCase().includes(search)
      )
    const matchProvince = !provinceFilter ||
      v.schedules.some(s => s.province === provinceFilter)
    return matchSearch && matchProvince
  })

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">รายชื่อสัตวแพทย์</h1>
        <p className="text-gray-500 text-sm mt-0.5">สัตวแพทย์ฝังเข็มที่ลงทะเบียนในระบบ VetAcu</p>
      </div>

      <div className="card bg-blue-50 border border-blue-100 mb-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">วิธีตรวจสอบใบอนุญาตประกอบวิชาชีพ</p>
          <p className="text-blue-600 mb-2">พิมพ์ชื่อหรือนามสกุลของหมอที่เว็บสัตวแพทยสภา เพื่อยืนยันว่าเป็นสัตวแพทย์จริง</p>
          <a href={VERIFY_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline hover:text-blue-900">
            ไปที่เว็บสัตวแพทยสภา <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="input pl-9"
            placeholder="ค้นหาชื่อหมอ, คลินิก, เขต, จังหวัด..."
          />
        </div>
        {allProvinces.length > 0 && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
            <select value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)}
              className="input flex-1">
              <option value="">ทุกจังหวัด</option>
              {allProvinces.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">
          <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{searchText || provinceFilter ? 'ไม่พบหมอที่ตรงกับการค้นหา' : 'ยังไม่มีหมอลงทะเบียน'}</p>
          {(searchText || provinceFilter) && (
            <button onClick={() => { setSearchText(''); setProvinceFilter('') }}
              className="text-primary-500 text-sm mt-2 hover:underline">
              ล้างการค้นหา
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(vet => (
            <Link key={vet.user_id} href={`/vets/${vet.user_id}`}
              className="card block hover:shadow-md transition-shadow">
              <div className="flex gap-4 items-center">
                <div className="shrink-0">
                  {vet.avatar_url ? (
                    <img src={vet.avatar_url} alt={vet.full_name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-gray-100" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">
                      {vet.full_name[0] || 'H'}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{vet.full_name}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        vet.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {vet.is_available ? '🟢 รับงาน' : '🔴 ไม่ว่าง'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>

                  {vet.license_number && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-xs text-gray-500">ใบอนุญาต: {vet.license_number}</span>
                    </div>
                  )}

                  {vet.schedules.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Array.from(new Set(vet.schedules.map(s => s.province))).map(p => (
                        <span key={p} className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {vet.additional_education?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {vet.additional_education.map(k => (
                        <span key={k} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                          {EDU_LABELS[k] || k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
