'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { createNotification } from '@/lib/notifications'
import { Check, X, ChevronDown, ChevronUp, Building2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const LABELS: Record<string, string> = {
  name: 'ชื่อ', name_en: 'ชื่อ (อังกฤษ)', type: 'ประเภท', phone: 'เบอร์โทร',
  line_id: 'LINE ID', facebook: 'Facebook', website: 'เว็บไซต์', address_detail: 'ที่อยู่',
}
const TYPE_LABEL = (v: string) => (v === 'hospital' ? 'โรงพยาบาลสัตว์' : v === 'clinic' ? 'คลินิก' : v)

type Status = 'pending' | 'approved' | 'rejected'

interface ClinicRef {
  id: string; name: string; name_en: string | null; type: string; phone: string | null
  line_id: string | null; facebook: string | null; website: string | null; address_detail: string | null
}
interface Req {
  id: string; clinic_id: string; requester_id: string; proposed: Record<string, string>
  status: Status; admin_note: string | null; created_at: string
  clinics: ClinicRef | null
  profiles: { full_name: string } | null
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function ClinicEditReviewList() {
  const supabase = createClient()
  const [items, setItems] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | 'all'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('clinic_edit_requests')
      .select('*, clinics(id, name, name_en, type, phone, line_id, facebook, website, address_detail), profiles!requester_id(full_name)')
      .order('created_at', { ascending: false })
    setItems((data as any) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const decide = async (r: Req, decision: 'approved' | 'rejected') => {
    const note = notes[r.id] || ''
    if (decision === 'rejected' && !note.trim()) { toast.error('กรุณาระบุเหตุผลที่ปฏิเสธ'); return }
    setSaving(r.id)
    const { error } = await supabase.rpc('admin_decide_clinic_edit', {
      p_request_id: r.id, p_decision: decision, p_note: note || null,
    })
    if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); setSaving(null); return }
    await createNotification(
      r.requester_id,
      decision === 'approved' ? `อนุมัติแก้ข้อมูล "${r.clinics?.name || ''}" แล้ว` : `ปฏิเสธคำขอแก้ข้อมูล "${r.clinics?.name || ''}"`,
      note || undefined,
    )
    toast.success(decision === 'approved' ? 'อนุมัติและอัปเดตแล้ว' : 'ปฏิเสธแล้ว')
    setSaving(null)
    load()
  }

  const shown = items.filter(r => filter === 'all' ? true : r.status === filter)
  const pendingCount = items.filter(r => r.status === 'pending').length

  const fmtVal = (key: string, v: string | null | undefined) =>
    key === 'type' ? TYPE_LABEL(v || '') : (v && v.trim() ? v : '—')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {pendingCount > 0 ? `รอตรวจสอบ ${pendingCount} คำขอ` : 'ไม่มีคำขอรอตรวจสอบ'}
        </p>
        <div className="flex gap-1 text-sm">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors
                ${filter === f ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {f === 'pending' ? 'รอตรวจสอบ' : f === 'approved' ? 'อนุมัติแล้ว' : f === 'rejected' ? 'ปฏิเสธ' : 'ทั้งหมด'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">กำลังโหลด...</div>
      ) : shown.length === 0 ? (
        <div className="card text-center py-14">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">ไม่มีคำขอแก้ข้อมูล</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(r => {
            const expanded = expandedId === r.id
            const keys = Object.keys(r.proposed).filter(k => k !== '_reason')
            const note = notes[r.id] ?? (r.admin_note || '')
            return (
              <div key={r.id} className="card space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-primary-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{r.clinics?.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${r.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                          : r.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                        {r.status === 'pending' ? 'รอตรวจสอบ' : r.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ผู้ขอ: {r.profiles?.full_name || '—'} · {fmtDate(r.created_at)} · แก้ {keys.length} รายการ
                    </p>
                  </div>
                  <button onClick={() => setExpandedId(expanded ? null : r.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {expanded && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                    {/* diff */}
                    <div className="space-y-1.5">
                      {keys.map(k => (
                        <div key={k} className="text-sm flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400 min-w-[80px]">{LABELS[k] || k}</span>
                          <span className="line-through text-gray-400">{fmtVal(k, r.clinics?.[k as keyof ClinicRef] as string)}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium text-primary-700 dark:text-primary-300">{fmtVal(k, r.proposed[k])}</span>
                        </div>
                      ))}
                    </div>

                    {r.proposed._reason && (
                      <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">เหตุผล: {r.proposed._reason}</p>
                    )}

                    {r.status === 'pending' ? (
                      <div className="space-y-2">
                        <textarea value={note} onChange={e => setNotes(p => ({ ...p, [r.id]: e.target.value }))}
                          rows={2} className="input resize-none text-sm" placeholder="หมายเหตุ (บังคับเมื่อปฏิเสธ)..." />
                        <div className="flex gap-2">
                          <button onClick={() => decide(r, 'approved')} disabled={saving === r.id}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50">
                            <Check className="w-4 h-4" /> อนุมัติ & อัปเดต
                          </button>
                          <button onClick={() => decide(r, 'rejected')} disabled={saving === r.id}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50">
                            <X className="w-4 h-4" /> ปฏิเสธ
                          </button>
                        </div>
                      </div>
                    ) : r.admin_note ? (
                      <p className="text-xs text-gray-400">หมายเหตุ: {r.admin_note}</p>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
