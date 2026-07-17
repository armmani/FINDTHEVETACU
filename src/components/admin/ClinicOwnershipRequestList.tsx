'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Check, X, ChevronDown, ChevronUp, Building2 } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

interface Request {
  id: string
  requester_id: string
  status: 'pending' | 'approved' | 'rejected'
  proof_url: string | null
  admin_note: string | null
  created_at: string
  clinics: { id: string; name: string; type: 'clinic' | 'hospital'; province: string } | null
  profiles: { full_name: string; email: string | null } | null
}

/** ลิสต์คำขอเชื่อมโรงพยาบาล/คลินิกที่รออนุมัติ — ใช้ฝังท้ายหน้าตรวจสอบ (เช่น /admin/verify) */
export default function ClinicOwnershipRequestList() {
  const supabase = createClient()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase
      .from('clinic_ownership_requests')
      .select('id, requester_id, status, proof_url, admin_note, created_at, clinics(id, name, type, province), profiles!requester_id(full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRequests((data as any) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDecision = async (req: Request, decision: 'approved' | 'rejected') => {
    const note = notes[req.id] || ''
    if (decision === 'rejected' && !note.trim()) { toast.error('กรุณาระบุเหตุผลที่ปฏิเสธ'); return }
    setProcessing(req.id)

    const { error } = await supabase.rpc('admin_decide_clinic_claim', {
      p_request_id: req.id, p_decision: decision, p_note: note || null,
    })
    if (error) { toast.error('เกิดข้อผิดพลาด: ' + error.message); setProcessing(null); return }

    if (req.clinics) {
      await supabase.from('notifications').insert({
        user_id: req.requester_id,
        title: decision === 'approved' ? `✅ อนุมัติการเชื่อมโรงพยาบาล "${req.clinics.name}"` : `❌ ปฏิเสธการเชื่อมโรงพยาบาล "${req.clinics.name}"`,
        body: note || null,
        link: decision === 'approved' ? '/clinic/manage' : '/clinic/claim',
      })
    }

    toast.success(decision === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว')
    setProcessing(null)
    load()
  }

  if (loading) return null

  return (
    <div>
      <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-primary-600" /> คำขอเชื่อมโรงพยาบาล ({requests.length})
      </h2>
      {requests.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">ไม่มีคำขอที่รออนุมัติ</div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const isExpanded = expandedId === req.id
            return (
              <div key={req.id} className="card">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-primary-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{req.clinics?.name}</p>
                    <p className="text-sm text-gray-500">
                      {req.clinics?.type === 'clinic' ? 'คลินิก' : 'โรงพยาบาลสัตว์'}{req.clinics?.province ? ` · ${req.clinics.province}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ผู้ขอ: {req.profiles?.full_name} · {fmtDate(req.created_at)}
                    </p>
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    className="text-gray-400 hover:text-gray-600 shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                    {req.proof_url ? (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">หลักฐาน:</p>
                        <a href={req.proof_url} target="_blank" rel="noopener noreferrer"
                          className="block w-40 h-32 relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity">
                          <Image src={req.proof_url} alt="proof" fill className="object-cover" />
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">ไม่มีหลักฐานแนบมา</p>
                    )}
                    <textarea
                      value={notes[req.id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                      rows={2} className="input resize-none text-sm" placeholder="หมายเหตุ (บังคับเมื่อปฏิเสธ)..."
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleDecision(req, 'approved')} disabled={processing === req.id}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors disabled:opacity-50">
                        <Check className="w-4 h-4" /> อนุมัติ
                      </button>
                      <button onClick={() => handleDecision(req, 'rejected')} disabled={processing === req.id}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors disabled:opacity-50">
                        <X className="w-4 h-4" /> ปฏิเสธ
                      </button>
                    </div>
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
