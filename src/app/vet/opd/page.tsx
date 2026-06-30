'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ClipboardList, Plus, ChevronRight, Users, Activity, Building2, LogOut, X, Check } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import LoadingScreen from '@/components/LoadingScreen'
import toast from 'react-hot-toast'

const EMOJI: Record<string, string> = { สุนัข: '🐕', แมว: '🐈', กระต่าย: '🐇', นก: '🐦', ปลา: '🐟', อื่นๆ: '🐾' }
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

const REASONS = [
  { value: 'recovered',    label: 'หายเป็นปกติ',   icon: '✅' },
  { value: 'deceased',     label: 'เสียชีวิต',     icon: '🕊️' },
  { value: 'lost_contact', label: 'ขาดการติดต่อ', icon: '📵' },
] as const

const REASON_LABEL: Record<string, string> = {
  recovered: '✅ หายเป็นปกติ', deceased: '🕊️ เสียชีวิต', lost_contact: '📵 ขาดการติดต่อ',
}

interface Patient {
  pet_id: string; latest_id: string; latest_date: string
  dx: string | null; weight: number | null; visits: number
  name: string; species: string; breed: string | null; photo_url: string | null
  tags: string[]; owner_name: string | null; clinic_name: string | null
  discharge?: { reason: string; discharged_at: string }
}

function MedicalTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map(t => (
        <span key={t} className="text-xs bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded-full font-medium">
          ⚠️ {t}
        </span>
      ))}
    </div>
  )
}

export default function OPDPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [clinicCount, setClinicCount] = useState(0)
  const [tab, setTab] = useState<'active' | 'discharged'>('active')
  const [discharging, setDischarging] = useState<Patient | null>(null)
  const [dischargeReason, setDischargeReason] = useState<'recovered' | 'deceased' | 'lost_contact'>('recovered')
  const [processing, setProcessing] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: records }, { data: discharges }] = await Promise.all([
      supabase
        .from('opd_records')
        .select('id, pet_id, record_date, dx, weight, pets(name, species, breed, photo_url, medical_tags, profiles!owner_id(full_name)), clinics(id, name)')
        .eq('vet_id', user.id)
        .order('record_date', { ascending: false }),
      supabase
        .from('vet_patient_discharges')
        .select('pet_id, reason, discharged_at')
        .eq('vet_id', user.id),
    ])

    const dischargeMap = new Map<string, { reason: string; discharged_at: string }>(
      (discharges || []).map((d: any) => [d.pet_id, { reason: d.reason, discharged_at: d.discharged_at }])
    )

    const clinicSet = new Set<string>()
    const patientMap = new Map<string, Patient>()

    for (const r of (records || []) as any[]) {
      if (r.clinics?.id) clinicSet.add(r.clinics.id)
      if (!patientMap.has(r.pet_id)) {
        patientMap.set(r.pet_id, {
          pet_id: r.pet_id, latest_id: r.id, latest_date: r.record_date,
          dx: r.dx, weight: r.weight, visits: 1,
          name: r.pets?.name || '?', species: r.pets?.species || '',
          breed: r.pets?.breed ?? null, photo_url: r.pets?.photo_url ?? null,
          tags: r.pets?.medical_tags || [],
          owner_name: r.pets?.profiles?.full_name ?? null,
          clinic_name: r.clinics?.name ?? null,
          discharge: dischargeMap.get(r.pet_id),
        })
      } else {
        patientMap.get(r.pet_id)!.visits++
      }
    }

    setPatients(Array.from(patientMap.values()))
    setClinicCount(clinicSet.size)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDischarge = async () => {
    if (!discharging) return
    setProcessing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProcessing(false); return }

    const { error } = await supabase.from('vet_patient_discharges').upsert(
      { vet_id: user.id, pet_id: discharging.pet_id, reason: dischargeReason, discharged_at: new Date().toISOString() },
      { onConflict: 'vet_id,pet_id' }
    )
    setProcessing(false)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('Discharge แล้ว')
    setDischarging(null)
    load()
  }

  if (loading) return <LoadingScreen />

  const active = patients.filter(p => !p.discharge)
  const discharged = patients.filter(p => p.discharge)
  const shown = tab === 'active' ? active : discharged

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary-600" /> OPD
        </h1>
        <Link href="/vet/opd/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> บันทึกใหม่
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'สัตว์ป่วยทั้งหมด', value: patients.length, icon: <Users className="w-5 h-5" />, color: 'text-primary-600' },
          { label: 'Active',        value: active.length,    icon: <Activity className="w-5 h-5" />, color: 'text-green-600' },
          { label: 'คลินิก/รพ.',        value: clinicCount,       icon: <Building2 className="w-5 h-5" />, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4 space-y-1">
            <div className={`flex justify-center ${s.color}`}>{s.icon}</div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-gray-500 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(['active', 'discharged'] as const).map(t => {
          const count = t === 'active' ? active.length : discharged.length
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${tab === t
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {t === 'active' ? 'Active' : 'Discharged'}
              {count > 0 && (
                <span className={`ml-1.5 text-xs rounded-full px-1.5
                  ${tab === t
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <div className="card text-center py-14">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {tab === 'active' ? 'ยังไม่มีรายการ Active' : 'ยังไม่มีรายการ Discharged'}
          </p>
          {tab === 'active' && (
            <Link href="/vet/opd/new" className="btn-primary inline-flex mt-4 gap-2 text-sm">
              <Plus className="w-4 h-4" /> บันทึก OPD แรก
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(p => (
            <div key={p.pet_id} className="card">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                  {p.photo_url
                    ? <Image src={p.photo_url} alt={p.name} width={40} height={40} className="w-full h-full object-cover" />
                    : <span className="text-xl">{EMOJI[p.species] || '🐾'}</span>
                  }
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/vet/opd/${p.latest_id}`)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{p.name}</p>
                    {p.clinic_name && <span className="text-xs text-gray-400">{p.clinic_name}</span>}
                    <span className="text-xs text-gray-300 dark:text-gray-600">{p.visits} ครั้ง</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {p.species}{p.breed ? ` · ${p.breed}` : ''}{p.owner_name ? ` · ${p.owner_name}` : ''}
                  </p>
                  <MedicalTags tags={p.tags} />
                  <p className="text-xs text-gray-400 mt-1">
                    ล่าสุด {fmtDate(p.latest_date)}{p.weight != null ? ` · ${p.weight} kg` : ''}{p.dx ? ` · ${p.dx}` : ''}
                  </p>
                  {p.discharge && (
                    <p className="text-xs text-gray-400">{REASON_LABEL[p.discharge.reason]} · {fmtDate(p.discharge.discharged_at)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {tab === 'active' && (
                    <button
                      onClick={e => { e.stopPropagation(); setDischarging(p); setDischargeReason('recovered') }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 border border-gray-200 dark:border-gray-700 hover:border-red-300 px-2 py-1 rounded-lg transition-colors">
                      <LogOut className="w-3.5 h-3.5" /> Discharge
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 cursor-pointer" onClick={() => router.push(`/vet/opd/${p.latest_id}`)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Discharge modal */}
      {discharging && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setDischarging(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Discharge</h3>
                <p className="text-sm text-gray-500">{discharging.name}</p>
              </div>
              <button onClick={() => setDischarging(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {REASONS.map(r => (
                <button key={r.value} onClick={() => setDischargeReason(r.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left
                    ${dischargeReason === r.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                  <span className="text-lg">{r.icon}</span>
                  <span className="font-medium text-sm flex-1">{r.label}</span>
                  {dischargeReason === r.value && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <button onClick={handleDischarge} disabled={processing}
              className="btn-primary w-full flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" />
              {processing ? 'กำลังบันทึก...' : 'ยืนยัน Discharge'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
