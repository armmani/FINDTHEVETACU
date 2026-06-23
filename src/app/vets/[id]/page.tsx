'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ShieldCheck, ExternalLink, MapPin, Calendar, ArrowLeft, Phone, Clock } from 'lucide-react'

interface Slot {
  day: number
  start_time: string
  end_time: string
}

interface VetSchedule {
  id: string
  place_name: string
  clinic_phone: string | null
  sub_district: string | null
  district: string | null
  province: string
  slots: Slot[]
}

interface VetDetail {
  user_id: string
  title: string | null
  bio: string | null
  license_number: string | null
  additional_education: string[]
  is_available: boolean
  location_name: string | null
  acupuncture_fee: number | null
  travel_rate: number | null
  full_name: string
  avatar_url: string | null
  phone: string | null
  schedules: VetSchedule[]
}

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

const EDU_LABELS: Record<string, string> = {
  internship: 'Internship (ฝึกอบรมพิเศษ)',
  certificate: 'Certificate (ใบรับรองเฉพาะทาง)',
  resident: 'Resident (ผู้เชี่ยวชาญ)',
}

const VERIFY_URL = 'http://209.15.98.88/index.php?option=com_content&view=article&id=183'

export default function VetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [vet, setVet] = useState<VetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: vp }, { data: schedules }] = await Promise.all([
        supabase
          .from('vet_profiles')
          .select(`
            user_id, title, bio, license_number, additional_education,
            is_available, location_name, acupuncture_fee, travel_rate,
            profiles!inner(full_name, avatar_url, phone)
          `)
          .eq('user_id', id)
          .single(),
        supabase.from('vet_schedules').select('*').eq('vet_id', id).order('created_at'),
      ])

      if (!vp) { setLoading(false); return }
      setVet({
        ...(vp as any),
        full_name: (vp as any).profiles?.full_name || '',
        avatar_url: (vp as any).profiles?.avatar_url || null,
        phone: (vp as any).profiles?.phone || null,
        schedules: (schedules as VetSchedule[]) || [],
      })
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
  if (!vet) return <div className="text-center py-20 text-gray-400">ไม่พบข้อมูลหมอ</div>

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">โปรไฟล์สัตวแพทย์</h1>
      </div>

      {/* รูปและชื่อ */}
      <div className="card flex flex-col items-center text-center gap-3">
        {vet.avatar_url ? (
          <button onClick={() => setLightbox(true)} className="relative group cursor-zoom-in">
            <img src={vet.avatar_url} alt={vet.full_name}
              className="w-24 h-24 rounded-full object-cover border-4 border-primary-100 group-hover:brightness-90 transition-all" />
            <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-xs bg-black/40 px-2 py-0.5 rounded-full">ขยาย</span>
            </div>
          </button>
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-3xl font-bold">
            {vet.full_name[0] || 'H'}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold">{vet.title ? `${vet.title}${vet.full_name}` : vet.full_name}</h2>
          <span className={`inline-block text-sm px-3 py-0.5 rounded-full font-medium mt-1 ${
            vet.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {vet.is_available ? '🟢 รับงาน' : '🔴 ไม่ว่าง'}
          </span>
        </div>

        {vet.additional_education?.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {vet.additional_education.map(k => (
              <span key={k} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                {EDU_LABELS[k] || k}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ใบอนุญาต */}
      {vet.license_number && (
        <div className="card flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-500">เลขใบอนุญาต</p>
            <p className="font-semibold">{vet.license_number}</p>
          </div>
          <a href={VERIFY_URL} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline flex items-center gap-1 shrink-0">
            ตรวจสอบ <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* bio */}
      {vet.bio && (
        <div className="card">
          <p className="text-sm font-semibold text-gray-500 mb-1">เกี่ยวกับหมอ</p>
          <p className="text-sm leading-relaxed">{vet.bio}</p>
        </div>
      )}

      {/* เบอร์ติดต่อหมอ */}
      {vet.phone && (
        <div className="card flex items-center gap-3">
          <Phone className="w-4 h-4 text-primary-500 shrink-0" />
          <div>
            <p className="text-sm text-gray-500">เบอร์ติดต่อหมอ</p>
            <a href={`tel:${vet.phone}`} className="font-semibold text-primary-600 hover:underline">{vet.phone}</a>
          </div>
        </div>
      )}

      {/* ตารางออกตรวจ */}
      {vet.schedules.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-primary-500" />
            <p className="font-semibold">ตารางออกตรวจ</p>
          </div>
          {vet.schedules.map(s => (
            <div key={s.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <p className="font-medium text-sm">{s.place_name}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {[s.sub_district, s.district, s.province].filter(Boolean).join(' · ')}
              </div>
              {s.clinic_phone && (
                <a href={`tel:${s.clinic_phone}`} className="flex items-center gap-1 text-xs text-primary-600 hover:underline mt-0.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  {s.clinic_phone}
                </a>
              )}
              <div className="mt-1.5 space-y-1">
                {(s.slots || []).map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-medium">
                      {DAY_NAMES[slot.day]}
                    </span>
                    <Clock className="w-3 h-3 text-gray-400" />
                    {slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)} น.
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* coming soon */}
      <div className="card bg-amber-50 border border-amber-100 text-center py-4">
        <p className="text-amber-700 font-medium text-sm">🔧 ระบบนัดหมายออนไลน์กำลังจะเปิดเร็วๆ นี้</p>
        <p className="text-amber-600 text-xs mt-1">ขณะนี้สามารถดูตารางออกตรวจและติดต่อคลินิกโดยตรง</p>
      </div>

      {/* Lightbox */}
      {lightbox && vet?.avatar_url && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={vet.avatar_url} alt={vet.full_name}
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
