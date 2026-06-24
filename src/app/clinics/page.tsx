'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Building2, MapPin, Phone, Search, ChevronRight, Clock } from 'lucide-react'
import Link from 'next/link'
import { useLang } from '@/contexts/LanguageContext'
import { toProvinceEn } from '@/lib/provinces'

interface Clinic {
  id: string
  name: string
  name_en: string | null
  type: 'clinic' | 'hospital'
  phone: string | null
  province: string
  district: string | null
  opening_hours: Record<string, { open: string; close: string }> | null
  clinic_specialties: { specialty_types: { name_th: string; name_en: string } }[]
}

const DAY_NAMES: Record<string, string> = {
  '1': 'จ', '2': 'อ', '3': 'พ', '4': 'พฤ', '5': 'ศ', '6': 'ส', '0': 'อา',
}

const TYPE_LABELS = { clinic: 'คลินิก', hospital: 'โรงพยาบาลสัตว์' }
const TYPE_LABELS_EN = { clinic: 'Clinic', hospital: 'Animal Hospital' }

export default function ClinicsPage() {
  const supabase = createClient()
  const { lang } = useLang()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [provinceFilter, setProvinceFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name, name_en, type, phone, province, district, opening_hours, clinic_specialties(specialty_types(name_th, name_en))')
        .eq('status', 'approved')
        .order('name')
      setClinics((data as Clinic[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const allProvinces = Array.from(new Set(clinics.map(c => c.province))).sort()

  const filtered = clinics.filter(c => {
    const s = search.toLowerCase()
    const matchSearch = !s ||
      c.name.toLowerCase().includes(s) ||
      c.name_en?.toLowerCase().includes(s) ||
      c.province.toLowerCase().includes(s) ||
      c.district?.toLowerCase().includes(s) ||
      c.clinic_specialties.some(sp => sp.specialty_types?.name_th.toLowerCase().includes(s) || sp.specialty_types?.name_en.toLowerCase().includes(s))
    const matchProvince = !provinceFilter || c.province === provinceFilter
    const matchType = !typeFilter || c.type === typeFilter
    return matchSearch && matchProvince && matchType
  })

  const todayOpen = (hours: Record<string, { open: string; close: string }> | null) => {
    if (!hours) return null
    const day = new Date().getDay().toString()
    return hours[day] || null
  }

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{lang === 'en' ? 'Clinics & Hospitals' : 'คลินิกและโรงพยาบาลสัตว์'}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {lang === 'en' ? 'Find animal clinics and hospitals with acupuncture services' : 'ค้นหาคลินิกและโรงพยาบาลสัตว์ที่มีบริการฝังเข็ม'}
        </p>
      </div>

      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9"
            placeholder={lang === 'en' ? 'Search clinic, province, specialty...' : 'ค้นหาชื่อคลินิก, จังหวัด, แผนก...'} />
        </div>
        <div className="flex gap-2">
          <select value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)} className="input flex-1">
            <option value="">{lang === 'en' ? 'All Provinces' : 'ทุกจังหวัด'}</option>
            {allProvinces.map(p => <option key={p} value={p}>{lang === 'en' ? toProvinceEn(p) : p}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input flex-1">
            <option value="">{lang === 'en' ? 'All Types' : 'ทุกประเภท'}</option>
            <option value="clinic">{lang === 'en' ? 'Clinic' : 'คลินิก'}</option>
            <option value="hospital">{lang === 'en' ? 'Animal Hospital' : 'โรงพยาบาลสัตว์'}</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{search || provinceFilter || typeFilter ? 'ไม่พบคลินิกที่ตรงกัน' : 'ยังไม่มีคลินิกในระบบ'}</p>
          {(search || provinceFilter || typeFilter) && (
            <button onClick={() => { setSearch(''); setProvinceFilter(''); setTypeFilter('') }}
              className="text-primary-500 text-sm mt-2 hover:underline">ล้างการค้นหา</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(clinic => {
            const today = todayOpen(clinic.opening_hours)
            return (
              <Link key={clinic.id} href={`/clinics/${clinic.id}`}
                className="card block hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">
                        {lang === 'en' && clinic.name_en ? clinic.name_en : clinic.name}
                      </h3>
                      <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
                        {lang === 'en' ? TYPE_LABELS_EN[clinic.type] : TYPE_LABELS[clinic.type]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {[clinic.district, lang === 'en' ? toProvinceEn(clinic.province) : clinic.province].filter(Boolean).join(' · ')}
                    </div>

                    {clinic.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Phone className="w-3 h-3 shrink-0" />
                        {clinic.phone}
                      </div>
                    )}

                    {today && (
                      <div className="flex items-center gap-1 text-xs text-green-600 mt-0.5">
                        <Clock className="w-3 h-3 shrink-0" />
                        {lang === 'en' ? 'Today' : 'วันนี้'}: {today.open}–{today.close}
                      </div>
                    )}

                    {clinic.clinic_specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {clinic.clinic_specialties.map((sp, i) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                            {lang === 'en' ? sp.specialty_types?.name_en : sp.specialty_types?.name_th}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
