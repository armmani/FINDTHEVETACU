'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { MessageSquarePlus, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface FeedbackItem {
  id: string
  message: string
  image_url: string | null
  status: 'pending' | 'reviewed'
  admin_note: string | null
  created_at: string
  profiles: { full_name: string; role: string } | null
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function AdminFeedbackPage() {
  const supabase = createClient()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('feedback')
      .select('*, profiles!user_id(full_name, role)')
      .order('created_at', { ascending: false })
    setItems((data as any[]) || [])
    setLoading(false)
  }

  const markReviewed = async (id: string, note: string) => {
    setSaving(id)
    const { error } = await supabase
      .from('feedback')
      .update({ status: 'reviewed', admin_note: note.trim() || null })
      .eq('id', id)
    setSaving(null)
    if (error) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('บันทึกแล้ว')
    setItems(prev => prev.map(f => f.id === id ? { ...f, status: 'reviewed', admin_note: note.trim() || null } : f))
  }

  const shown = items.filter(f => filter === 'all' ? true : f.status === filter)
  const pendingCount = items.filter(f => f.status === 'pending').length

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquarePlus className="w-6 h-6 text-primary-600" /> Feedback
          {pendingCount > 0 && (
            <span className="text-sm bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
              {pendingCount} ใหม่
            </span>
          )}
        </h1>
        <div className="flex gap-1 text-sm">
          {(['pending', 'all', 'reviewed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium
                ${filter === f ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {f === 'pending' ? 'รอดู' : f === 'reviewed' ? 'ดูแล้ว' : 'ทั้งหมด'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : shown.length === 0 ? (
        <div className="card text-center py-16">
          <MessageSquarePlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">ยังไม่มี Feedback</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(f => {
            const expanded = expandedId === f.id
            const note = noteInputs[f.id] ?? (f.admin_note || '')
            return (
              <div key={f.id} className="card space-y-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 ${f.status === 'reviewed' ? 'text-green-500' : 'text-amber-500'}`}>
                    {f.status === 'reviewed'
                      ? <CheckCircle className="w-5 h-5" />
                      : <Clock className="w-5 h-5" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{f.profiles?.full_name || 'ผู้ใช้'}</p>
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        {f.profiles?.role === 'vet' ? 'หมอ' : f.profiles?.role === 'owner' ? 'เจ้าของ' : f.profiles?.role}
                      </span>
                      <span className="text-xs text-gray-400">{fmtDate(f.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap leading-relaxed">{f.message}</p>
                  </div>
                  <button onClick={() => setExpandedId(expanded ? null : f.id)}
                    className="text-gray-400 hover:text-gray-600 shrink-0">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Image */}
                {f.image_url && (
                  <a href={f.image_url} target="_blank" rel="noopener noreferrer" className="block">
                    <Image src={f.image_url} alt="feedback" width={600} height={300}
                      className="w-full max-h-60 object-contain rounded-xl bg-gray-50 dark:bg-gray-800" />
                  </a>
                )}

                {/* Expandable: admin note + mark reviewed */}
                {expanded && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    <textarea
                      value={note}
                      onChange={e => setNoteInputs(prev => ({ ...prev, [f.id]: e.target.value }))}
                      className="input resize-none w-full text-sm"
                      rows={2}
                      placeholder="Note ของ admin (ถ้ามี)..."
                    />
                    {f.status === 'pending' && (
                      <button
                        onClick={() => markReviewed(f.id, note)}
                        disabled={saving === f.id}
                        className="btn-primary text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {saving === f.id ? 'กำลังบันทึก...' : 'Mark as Reviewed'}
                      </button>
                    )}
                    {f.status === 'reviewed' && f.admin_note && (
                      <p className="text-xs text-gray-400">Note: {f.admin_note}</p>
                    )}
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
