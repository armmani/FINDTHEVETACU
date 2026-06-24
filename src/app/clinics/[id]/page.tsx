'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Building2, MapPin, Phone, Clock, Globe, ArrowLeft, ExternalLink, Stethoscope, User } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { toProvinceEn } from '@/lib/provinces'
import Link from 'next/link'

interface Specialty {
  id: string
  specialty_type_id: string
  opening_hours: Record<string, { open: string; close: string }> | null
  specialty_types: { name_th: string; name_en: string }
}

interface VetInClinic {
  vet_id: string
  title: string | null
  full_name_en: string | null
  is_available: boolean
  profiles: { full_name: string; avatar_url: string | null }
}

interface ClinicDetail {
  id: string
  name: string
  name_en: string | null
  type: 'clinic' | 'hospital'
  phone: string | null
  line_id: string | null
  facebook: string | null
  website: string | null
  province: string
  district: string | null
  sub_district: string | null
  address_detail: string | null
  opening_hours: Record<string, { open: string; close: string }> | null
  clinic_specialties: Specialty[]
}

const DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TYPE_LABELS = { clinic: 'คลินิก', hospital: 'โรงพยาบาลสัตว์' }
const TYPE_LABELS_EN = { clinic: 'Clinic', hospital: 'Animal Hospital' }

function HoursTable({ hours, lang }: { hours: Record<string, { open: string; close: string }> | null; lang: string }) {
  if (!hours || Object.keys(hours).length === 0) return null
  const days = lang === 'en' ? DAY_EN : DAY_TH
  return (
    <div className="space-y-1">
      {[1,2,3,4,5,6,0].map(d => {
        const h = hours[d.toString()]
        if (!h) return null
        return (
          <div key={d} className="flex items-center justify-between text-sm">
            <span className="text-gray-500 w-24">{days[d]}</span>
            <span className="font-medium">{h.open} – {h.close}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { lang } = useLang()
  const [clinic, setClinic] = useState<ClinicDetail | null>(null)
  const [vets, setVets] = useState<VetInClinic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: schedules }] = await Promise.all([
        supabase
          .from('clinics')
          .select('*, clinic_specialties(*, specialty_types(name_th, name_en))')
          .eq('id', id)
          .eq('status', 'approved')
          .single(),
        supabase
          .from('vet_schedules')
          .select('vet_id, vet_profiles!inner(title, full_name_en, is_available, profiles!inner(full_name, avatar_url))')
          .eq('clinic_id', id),
      ])

      setClinic(c as ClinicDetail)

      if (schedules) {
        const seen = new Set<string>()
        const unique = (schedules as any[]).filter(s => {
          if (seen.has(s.vet_id)) return false
          seen.add(s.vet_id)
          return true
        }).map(s => ({
          vet_id: s.vet_id,
          title: s.vet_profiles?.title,
          full_name_en: s.vet_profiles?.full_name_en,
          is_available: s.vet_profiles?.is_available,
          profiles: s.vet_profiles?.profiles,
        }))
        setVets(unique)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
  if (!clinic) return <div className="text-center py-20 text-gray-400">ไม่พบข้อมูลคลินิก</div>

  const provinceDisplay = lang === 'en' ? toProvinceEn(clinic.province) : clinic.province
  const typeLabel = lang === 'en' ? TYPE_LABELS_EN[clinic.type] : TYPE_LABELS[clinic.type]

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">{typeLabel}</h1>
      </div>

      {/* ชื่อและประเภท */}
      <div className="card text-center py-6">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Building2 className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-xl font-bold">
          {lang === 'en' && clinic.name_en ? clinic.name_en : clinic.name}
        </h2>
        <span className="text-xs bg-primary-50 text-primary-600 px-3 py-1 rounded-full mt-1 inline-block">
          {typeLabel}
        </span>
      </div>

      {/* ที่อยู่ & ติดต่อ */}
      <div className="card space-y-3">
        <p className="font-semibold text-sm text-gray-500">{lang === 'en' ? 'Contact' : 'ช่องทางติดต่อ'}</p>
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <span>{[clinic.address_detail, clinic.sub_district, clinic.district, provinceDisplay].filter(Boolean).join(', ')}</span>
        </div>
        {clinic.phone && (
          <a href={`tel:${clinic.phone}`} className="flex items-center gap-2 text-sm text-primary-600 hover:underline">
            <Phone className="w-4 h-4 shrink-0" />
            {clinic.phone}
          </a>
        )}
        {clinic.line_id && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-500 font-bold text-xs w-4 text-center">LINE</span>
            <span>{clinic.line_id}</span>
          </div>
        )}
        {clinic.facebook && (
          <a href={clinic.facebook} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
            <Globe className="w-4 h-4 shrink-0" />
            Facebook
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {clinic.website && (
          <a href={clinic.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary-500 hover:underline">
            <Globe className="w-4 h-4 shrink-0" />
            {clinic.website}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* เวลาเปิด-ปิด */}
      {clinic.opening_hours && Object.keys(clinic.opening_hours).length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary-500" />
            <p className="font-semibold">{lang === 'en' ? 'Opening Hours' : 'เวลาเปิด-ปิด'}</p>
          </div>
          <HoursTable hours={clinic.opening_hours} lang={lang} />
        </div>
      )}

      {/* แผนกเฉพาะทาง */}
      {clinic.clinic_specialties.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="w-4 h-4 text-primary-500" />
            <p className="font-semibold">{lang === 'en' ? 'Specialties' : 'แผนกเฉพาะทาง'}</p>
          </div>
          {clinic.clinic_specialties.map(sp => (
            <div key={sp.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="font-medium text-sm">
                {lang === 'en' ? sp.specialty_types?.name_en : sp.specialty_types?.name_th}
              </p>
              {sp.opening_hours && Object.keys(sp.opening_hours).length > 0 && (
                <div className="mt-2">
                  <HoursTable hours={sp.opening_hours} lang={lang} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* หมอในระบบที่ออกตรวจที่นี่ */}
      {vets.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-primary-500" />
            <p className="font-semibold">{lang === 'en' ? 'Vets at this clinic' : 'สัตวแพทย์ที่ออกตรวจที่นี่'}</p>
          </div>
          {vets.map(v => (
            <Link key={v.vet_id} href={`/vets/${v.vet_id}`}
              className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {v.profiles?.avatar_url ? (
                <img src={v.profiles.avatar_url} alt={v.profiles.full_name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-100" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                  {v.profiles?.full_name?.[0] || 'H'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {lang === 'en' && v.full_name_en
                    ? `${v.full_name_en}, DVM`
                    : v.title ? `${v.title}${v.profiles?.full_name}` : v.profiles?.full_name}
                </p>
                <span className={`text-xs ${v.is_available ? 'text-green-600' : 'text-gray-400'}`}>
                  {v.is_available ? '🟢 รับงาน' : '🔴 ไม่ว่าง'}
                </span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
