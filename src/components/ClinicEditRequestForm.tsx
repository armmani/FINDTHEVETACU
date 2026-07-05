'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { notifyAdmin } from '@/lib/telegram'
import { Search, Loader2, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'

/** ฟิลด์ที่อนุญาตให้ขอแก้ไข (ต้องตรงกับ RPC admin_decide_clinic_edit) */
const FIELDS: { key: string; label: string; type?: 'select' }[] = [
  { key: 'name', label: 'ชื่อ' },
  { key: 'name_en', label: 'ชื่อ (อังกฤษ)' },
  { key: 'type', label: 'ประเภท', type: 'select' },
  { key: 'phone', label: 'เบอร์โทร' },
  { key: 'line_id', label: 'LINE ID' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'website', label: 'เว็บไซต์' },
  { key: 'address_detail', label: 'ที่อยู่ (รายละเอียด)' },
]

const DAYS = [
  { key: '1', label: 'จันทร์' }, { key: '2', label: 'อังคาร' },
  { key: '3', label: 'พุธ' }, { key: '4', label: 'พฤหัสบดี' },
  { key: '5', label: 'ศุกร์' }, { key: '6', label: 'เสาร์' },
  { key: '0', label: 'อาทิตย์' },
]

interface DayHours { open: string; close: string }
interface ClinicRow {
  id: string; name: string; type: string; province: string | null
  is_24_hours?: boolean; opening_hours?: Record<string, DayHours> | null
  [k: string]: any
}
interface SpecialtyType { id: string; name_th: string; name_en: string }

function sameOpeningHours(a: Record<string, DayHours> | null, b: Record<string, DayHours> | null) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {})
}
function sameIdSet(a: string[], b: string[]) {
  const as = [...a].sort(), bs = [...b].sort()
  return as.length === bs.length && as.every((v, i) => v === bs[i])
}

export default function ClinicEditRequestForm({ onDone }: { onDone: () => void }) {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClinicRow[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<ClinicRow | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // เวลาทำการ
  const [is24Hours, setIs24Hours] = useState(false)
  const [openingHours, setOpeningHours] = useState<Record<string, DayHours>>({})
  const [origIs24Hours, setOrigIs24Hours] = useState(false)
  const [origOpeningHours, setOrigOpeningHours] = useState<Record<string, DayHours> | null>(null)

  // แผนกที่ให้บริการ
  const [specialtyTypes, setSpecialtyTypes] = useState<SpecialtyType[]>([])
  const [specialtyIds, setSpecialtyIds] = useState<string[]>([])
  const [origSpecialtyIds, setOrigSpecialtyIds] = useState<string[]>([])

  useEffect(() => {
    supabase.from('specialty_types').select('id, name_th, name_en').order('name_th')
      .then(({ data }) => setSpecialtyTypes((data as SpecialtyType[]) || []))
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (selected || query.trim().length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const term = query.trim().replace(/[,()%\\]/g, '\\$&')
      const { data } = await supabase
        .from('clinics')
        .select('id, name, name_en, type, province')
        .eq('status', 'approved')
        .or(`name.ilike.%${term}%,name_en.ilike.%${term}%`)
        .order('name')
        .limit(8)
      setResults((data as ClinicRow[]) || [])
      setSearching(false)
    }, 300)
  }, [query, selected])

  const toggleDay = (day: string) => {
    setOpeningHours(prev => {
      if (prev[day]) { const n = { ...prev }; delete n[day]; return n }
      return { ...prev, [day]: { open: '09:00', close: '18:00' } }
    })
  }
  const updateDayHours = (day: string, field: 'open' | 'close', val: string) => {
    setOpeningHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))
  }
  const toggleSpecialty = (id: string) => {
    setSpecialtyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const pickClinic = async (c: ClinicRow) => {
    const { data } = await supabase.from('clinics').select('*').eq('id', c.id).single()
    const full = (data as ClinicRow) || c
    setSelected(full)
    const init: Record<string, string> = {}
    FIELDS.forEach(f => { init[f.key] = full[f.key] ?? '' })
    setValues(init)

    setIs24Hours(!!full.is_24_hours)
    setOrigIs24Hours(!!full.is_24_hours)
    setOpeningHours(full.opening_hours || {})
    setOrigOpeningHours(full.opening_hours || null)

    const { data: csData } = await supabase.from('clinic_specialties').select('specialty_type_id').eq('clinic_id', c.id)
    const ids = (csData || []).map((r: any) => r.specialty_type_id as string)
    setSpecialtyIds(ids)
    setOrigSpecialtyIds(ids)
  }

  const submit = async () => {
    if (!selected) return
    const proposed: Record<string, any> = {}
    FIELDS.forEach(f => {
      const cur = (selected[f.key] ?? '').toString()
      const next = (values[f.key] ?? '').toString().trim()
      if (next !== cur.trim()) proposed[f.key] = next
    })

    if (is24Hours !== origIs24Hours) proposed.is_24_hours = is24Hours
    const nextHours = is24Hours ? null : openingHours
    if (!sameOpeningHours(nextHours, origOpeningHours)) proposed.opening_hours = nextHours
    if (!sameIdSet(specialtyIds, origSpecialtyIds)) proposed.specialty_type_ids = specialtyIds

    if (Object.keys(proposed).length === 0) { toast.error('ยังไม่มีการเปลี่ยนแปลงข้อมูล'); return }

    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }
    if (reason.trim()) proposed._reason = reason.trim()

    const { error } = await supabase.from('clinic_edit_requests').insert({
      clinic_id: selected.id, requester_id: user.id, proposed,
    })
    setSending(false)
    if (error) { toast.error('ส่งคำขอไม่สำเร็จ: ' + error.message); return }

    // แจ้งแอดมินผ่าน Telegram (in-app มี DB trigger จัดการอยู่แล้ว)
    const fieldLabels: Record<string, string> = { is_24_hours: 'เปิด 24 ชั่วโมง', opening_hours: 'เวลาทำการ', specialty_type_ids: 'แผนกที่ให้บริการ' }
    const fields = Object.keys(proposed).filter(k => k !== '_reason').map(k => FIELDS.find(f => f.key === k)?.label || fieldLabels[k] || k)
    notifyAdmin(`✏️ <b>FindTheVet — คำขอแก้ข้อมูลคลินิก</b>\n\n<b>${selected.name}</b>\nขอแก้: ${fields.join(', ')}\nกรุณาตรวจสอบใน Admin → Feedback → ขอแก้ข้อมูล รพ.`)

    toast.success('ส่งคำขอแก้ข้อมูลแล้ว — แอดมินจะตรวจสอบก่อนอัปเดต')
    onDone()
  }

  if (!selected) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400">ค้นหาคลินิก/โรงพยาบาลที่ต้องการขอแก้ข้อมูล (แม้ไม่ใช่ผู้สร้าง)</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            className="input pl-9" placeholder="พิมพ์ชื่อคลินิก..." autoFocus />
        </div>
        {searching && <p className="text-xs text-center text-gray-400">กำลังค้นหา...</p>}
        {results.map(c => (
          <button key={c.id} onClick={() => pickClinic(c)}
            className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <p className="text-sm font-medium">{c.name}</p>
            <p className="text-xs text-gray-400">{c.type === 'hospital' ? 'โรงพยาบาลสัตว์' : 'คลินิก'}{c.province ? ` · ${c.province}` : ''}</p>
          </button>
        ))}
        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="text-xs text-center text-gray-400">ไม่พบคลินิกชื่อ "{query}"</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-950 rounded-xl px-3 py-2">
        <p className="text-sm font-semibold text-primary-800 dark:text-primary-200">{selected.name}</p>
        <button onClick={() => { setSelected(null); setValues({}) }} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-400">แก้เฉพาะช่องที่ต้องการเปลี่ยน — ระบบจะส่งเฉพาะส่วนที่แก้ให้แอดมินอนุมัติ</p>

      {FIELDS.map(f => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          {f.type === 'select' ? (
            <select value={values[f.key] || ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} className="input">
              <option value="clinic">คลินิก</option>
              <option value="hospital">โรงพยาบาลสัตว์</option>
            </select>
          ) : (
            <input value={values[f.key] || ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} className="input" />
          )}
        </div>
      ))}

      {/* เวลาทำการ */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={is24Hours} onChange={e => setIs24Hours(e.target.checked)}
            className="w-4 h-4 rounded accent-primary-600" />
          <span className="text-sm font-medium">เปิด 24 ชั่วโมง</span>
        </label>
        {!is24Hours && (
          <>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => (
                <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    openingHours[d.key] ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 dark:border-gray-600 text-gray-500'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
            {DAYS.filter(d => openingHours[d.key]).map(d => (
              <div key={d.key} className="flex items-center gap-2 text-sm">
                <span className="w-16 text-gray-600 dark:text-gray-400 shrink-0">{d.label}</span>
                <input type="time" value={openingHours[d.key].open}
                  onChange={e => updateDayHours(d.key, 'open', e.target.value)} className="input w-28" />
                <span className="text-gray-400">–</span>
                <input type="time" value={openingHours[d.key].close}
                  onChange={e => updateDayHours(d.key, 'close', e.target.value)} className="input w-28" />
              </div>
            ))}
          </>
        )}
      </div>

      {/* แผนกที่ให้บริการ */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
        <label className="label mb-0">แผนกที่ให้บริการ</label>
        {specialtyTypes.length === 0 ? (
          <p className="text-xs text-gray-400">ยังไม่มีแผนกในระบบ</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {specialtyTypes.map(sp => (
              <button key={sp.id} type="button" onClick={() => toggleSpecialty(sp.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  specialtyIds.includes(sp.id) ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:border-primary-400'
                }`}>
                {sp.name_th}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="label">เหตุผล / หมายเหตุ (ถ้ามี)</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="input resize-none"
          placeholder="เช่น เบอร์เดิมยกเลิกแล้ว, ย้ายที่อยู่..." />
      </div>

      <button onClick={submit} disabled={sending} className="btn-primary w-full flex items-center justify-center gap-2">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {sending ? 'กำลังส่ง...' : 'ส่งคำขอแก้ข้อมูล'}
      </button>
    </div>
  )
}
