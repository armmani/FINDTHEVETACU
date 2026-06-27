'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Check, X, ChevronDown, ChevronUp, PawPrint } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import LoadingScreen from '@/components/LoadingScreen'

const EMOJI: Record<string, string> = { สุนัข: '🐕', แมว: '🐈', กระต่าย: '🐇', นก: '🐦', ปลา: '🐟', อื่นๆ: '🐾' }
const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

type Status = 'pending' | 'approved' | 'rejected'

interface Request {
  id: string
  requester_id: string
  status: Status
  proof_url: string | null
  admin_note: string | null
  created_at: string
  pets: { id: string; name: string; species: string; breed: string | null } | null
  profiles: { full_name: string; email: string | null } | null
}

export default function OwnershipRequestsPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | 'all'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  const load = async () => {
    const q = supabase
      .from('pet_ownership_requests')
      .select('id, requester_id, status, proof_url, admin_note, created_at, pets(id, name, species, breed), profiles!requester_id(full_name, email)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') q.eq('status', filter)
    const { data } = await q
    setRequests((data as any) || [])
    setLoading(false)
  }

  useEffect(() => { setLoading(true); load() }, [filter])

  const handleDecision = async (req: Request, decision: 'approved' | 'rejected') => {
    const note = notes[req.id] || ''
    if (decision === 'rejected' && !note.trim()) {
      toast.error('กรุณาระบุเหตุผลที่ปฏิเสธ')
      return
    }
    setProcessing(req.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProcessing(null); return }

    const { error } = await supabase
      .from('pet_ownership_requests')
      .update({ status: decision, admin_note: note || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', req.id)

    if (error) { toast.error('เกิดข้อผิดพลาด'); setProcessing(null); return }

    if (decision === 'approved' && req.pets) {
      await supabase
        .from('pets')
        .update({ owner_id: req.requester_id })
        .eq('id', req.pets.id)

      await supabase.from('notifications').insert({
        user_id: req.requester_id,
        title: `✅ อนุมัติการเชื่อมสัตว์เลี้ยง "${req.pets.name}"`,
        body: note || null,
        link: `/owner/pets`,
      })
    } else if (decision === 'rejected' && req.pets) {
      await supabase.from('notifications').insert({
        user_id: req.requester_id,
        title: `❌ ปฏิเสธการเชื่อมสัตว์เลี้ยง "${req.pets.name}"`,
        body: note || null,
        link: `/owner/pets/claim`,
      })
    }

    toast.success(decision === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว')
    setProcessing(null)
    load()
  }

  if (loading) return <LoadingScreen />

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PawPrint className="w-6 h-6 text-primary-600" /> คำขอเชื่อมสัตว์เลี้ยง
          </h1>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">รออนุมัติ {pendingCount} คำขอ</p>
          )}
        </div>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-lg text-sm font-medium border transition-colors
                ${filter === s
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400'}`}>
              {s === 'pending' ? 'รออนุมัติ' : s === 'approved' ? 'อนุมัติแล้ว' : s === 'rejected' ? 'ปฏิเสธ' : 'ทั้งหมด'}
            </button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="card text-center py-14">
          <PawPrint className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">ไม่มีคำขอ{filter === 'pending' ? 'ที่รออนุมัติ' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="card">
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{EMOJI[req.pets?.species || ''] || '🐾'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{req.pets?.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${req.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                        : req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                      {req.status === 'pending' ? 'รออนุมัติ' : req.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {req.pets?.species}{req.pets?.breed ? ` · ${req.pets.breed}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    ผู้ขอ: {req.profiles?.full_name} · {fmtDate(req.created_at)}
                  </p>
                </div>
                <button onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  className="text-gray-400 hover:text-gray-600 shrink-0">
                  {expandedId === req.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {expandedId === req.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                  {/* Proof image */}
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

                  {req.admin_note && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">หมายเหตุแอดมิน:</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{req.admin_note}</p>
                    </div>
                  )}

                  {req.status === 'pending' && (
                    <div className="space-y-3">
                      <div>
                        <label className="label">หมายเหตุ (บังคับเมื่อปฏิเสธ)</label>
                        <textarea
                          value={notes[req.id] || ''}
                          onChange={e => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                          rows={2} className="input resize-none" placeholder="เหตุผล หรือคำแนะนำสำหรับผู้ขอ..."
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleDecision(req, 'approved')}
                          disabled={processing === req.id}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors disabled:opacity-50">
                          <Check className="w-4 h-4" /> อนุมัติ
                        </button>
                        <button
                          onClick={() => handleDecision(req, 'rejected')}
                          disabled={processing === req.id}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors disabled:opacity-50">
                          <X className="w-4 h-4" /> ปฏิเสธ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
