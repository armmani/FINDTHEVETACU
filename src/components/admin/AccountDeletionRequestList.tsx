'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Trash2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Row {
  id: string; user_id: string; reason: string | null; requested_at: string
  full_name: string; email: string | null; role: string
}

const fmt = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

export default function AccountDeletionRequestList() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const { data: reqs } = await supabase
      .from('account_deletion_requests')
      .select('id, user_id, reason, requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })

    const list = reqs || []
    if (list.length === 0) { setRows([]); setLoading(false); return }

    const ids = list.map((r: any) => r.user_id)
    const { data: people } = await supabase.from('profiles').select('id, full_name, email, role').in('id', ids)
    const pmap = new Map((people || []).map((p: any) => [p.id, p]))

    setRows(list.map((r: any) => {
      const p: any = pmap.get(r.user_id)
      return { ...r, full_name: p?.full_name || 'ผู้ใช้', email: p?.email ?? null, role: p?.role || 'owner' }
    }))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const decide = async (row: Row, status: 'done' | 'rejected') => {
    setBusy(row.id)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('account_deletion_requests')
      .update({ status, handled_at: new Date().toISOString(), handled_by: user?.id ?? null })
      .eq('id', row.id)
    setBusy(null)
    if (error) { toast.error('อัปเดตไม่สำเร็จ'); return }
    toast.success(status === 'done' ? 'ทำเครื่องหมายว่าลบแล้ว' : 'ปฏิเสธคำขอแล้ว')
    setRows(prev => prev.filter(r => r.id !== row.id))
  }

  if (loading || rows.length === 0) return null

  return (
    <div>
      <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
        <Trash2 className="w-5 h-5 text-red-500" /> คำขอลบบัญชี / ข้อมูล ({rows.length})
      </h2>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="card border-l-4 border-l-red-400 space-y-2">
            <div>
              <p className="font-semibold">{r.full_name}
                <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{r.role}</span>
              </p>
              {r.email && <p className="text-xs text-gray-400">{r.email}</p>}
              <p className="text-xs text-gray-400 mt-0.5">ขอเมื่อ {fmt(r.requested_at)}</p>
              {r.reason && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">เหตุผล: {r.reason}</p>}
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              ⚠️ ลบข้อมูลจริงใน Supabase (auth + ตารางที่เกี่ยวข้อง) ก่อน แล้วค่อยกด “ลบแล้ว”
            </p>
            <div className="flex gap-2">
              <button onClick={() => decide(r, 'done')} disabled={busy === r.id}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50">
                <Check className="w-4 h-4" /> ลบแล้ว
              </button>
              <button onClick={() => decide(r, 'rejected')} disabled={busy === r.id}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                <X className="w-4 h-4" /> ปฏิเสธ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
