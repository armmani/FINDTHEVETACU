'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
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

interface ClinicRow { id: string; name: string; type: string; province: string | null; [k: string]: any }

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

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (selected || query.trim().length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name, type, province')
        .eq('status', 'approved')
        .ilike('name', `%${query.trim()}%`)
        .order('name')
        .limit(8)
      setResults((data as ClinicRow[]) || [])
      setSearching(false)
    }, 300)
  }, [query, selected])

  const pickClinic = async (c: ClinicRow) => {
    const { data } = await supabase.from('clinics').select('*').eq('id', c.id).single()
    const full = (data as ClinicRow) || c
    setSelected(full)
    const init: Record<string, string> = {}
    FIELDS.forEach(f => { init[f.key] = full[f.key] ?? '' })
    setValues(init)
  }

  const submit = async () => {
    if (!selected) return
    const proposed: Record<string, string> = {}
    FIELDS.forEach(f => {
      const cur = (selected[f.key] ?? '').toString()
      const next = (values[f.key] ?? '').toString().trim()
      if (next !== cur.trim()) proposed[f.key] = next
    })
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
