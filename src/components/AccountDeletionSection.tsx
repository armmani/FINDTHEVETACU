'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Trash2, AlertTriangle, Clock, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { notifyAdmin } from '@/lib/telegram'

interface DeletionRequest { id: string; status: string; requested_at: string; reason: string | null }

export default function AccountDeletionSection() {
  const supabase = createClient()
  const [pending, setPending] = useState<DeletionRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('account_deletion_requests')
      .select('id, status, requested_at, reason')
      .eq('user_id', user.id).eq('status', 'pending')
      .maybeSingle()
    setPending((data as DeletionRequest) || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const submit = async () => {
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const { error } = await supabase.from('account_deletion_requests').insert({
      user_id: user.id, reason: reason.trim() || null,
    })
    setSubmitting(false)
    if (error) { toast.error('ส่งคำขอไม่สำเร็จ อาจมีคำขอค้างอยู่แล้ว'); return }

    notifyAdmin(`🗑️ <b>FindTheVet — คำขอลบบัญชี</b>\n\n<b>${(profile as any)?.full_name || 'ผู้ใช้'}</b> ขอลบบัญชีและข้อมูล${reason.trim() ? `\nเหตุผล: ${reason.trim()}` : ''}\nกรุณาตรวจสอบใน Admin`)
    toast.success('ส่งคำขอลบบัญชีแล้ว แอดมินจะดำเนินการให้')
    setOpen(false); setReason(''); load()
  }

  const cancel = async () => {
    if (!pending) return
    await supabase.from('account_deletion_requests').update({ status: 'cancelled' }).eq('id', pending.id)
    toast.success('ยกเลิกคำขอแล้ว')
    load()
  }

  if (loading) return null

  return (
    <div className="card border border-red-100 dark:border-red-900/50">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/50 flex items-center justify-center shrink-0">
          <Trash2 className="w-4 h-4 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">ลบบัญชีและข้อมูล</p>
          <p className="text-xs text-gray-400 mt-0.5">
            สิทธิ์ตาม PDPA — ขอให้เราลบบัญชีและข้อมูลส่วนบุคคลของคุณออกจากระบบ
          </p>

          {pending ? (
            <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 p-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
                <Clock className="w-4 h-4" /> ส่งคำขอลบบัญชีแล้ว รอแอดมินดำเนินการ
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ส่งเมื่อ {new Date(pending.requested_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <button onClick={cancel} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline mt-2">
                ยกเลิกคำขอ
              </button>
            </div>
          ) : !open ? (
            <button onClick={() => setOpen(true)}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 dark:border-red-900 rounded-lg px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
              ขอลบบัญชีและข้อมูล
            </button>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>เมื่อดำเนินการแล้ว บัญชีและข้อมูลของคุณจะถูกลบถาวรและกู้คืนไม่ได้</span>
              </div>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                className="input resize-none text-sm" placeholder="เหตุผล (ไม่บังคับ)" />
              <div className="flex gap-2">
                <button onClick={() => { setOpen(false); setReason('') }}
                  className="btn-secondary flex-1 text-sm py-2 flex items-center justify-center gap-1">
                  <X className="w-4 h-4" /> ยกเลิก
                </button>
                <button onClick={submit} disabled={submitting}
                  className="flex-1 text-sm py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50 transition-colors">
                  {submitting ? 'กำลังส่ง...' : 'ยืนยันขอลบบัญชี'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
