'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { MessageCircle, ChevronRight, Stethoscope } from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'

interface Row {
  id: string
  other_id: string
  other_name: string
  other_avatar: string | null
  other_role: string
  last_message: string | null
  last_sender_id: string | null
  last_message_at: string | null
  unread: number
}

const timeAgo = (iso: string | null) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'เมื่อกี้'
  if (mins < 60) return `${mins} นาที`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ชม.`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} วัน`
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export default function MessagesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: convos } = await supabase
        .from('conversations')
        .select('id, user_a, user_b, last_message, last_sender_id, last_message_at')
        .order('last_message_at', { ascending: false })

      const list = convos || []
      if (list.length === 0) { setRows([]); setLoading(false); return }

      const otherIds = list.map((c: any) => (c.user_a === user.id ? c.user_b : c.user_a))

      const [{ data: people }, { data: unreadMsgs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url, role').in('id', otherIds),
        supabase.from('direct_messages').select('conversation_id').is('read_at', null).neq('sender_id', user.id),
      ])

      const peopleMap = new Map((people || []).map((p: any) => [p.id, p]))
      const unreadMap = new Map<string, number>()
      for (const m of (unreadMsgs || []) as any[]) {
        unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) || 0) + 1)
      }

      setRows(list.map((c: any) => {
        const otherId = c.user_a === user.id ? c.user_b : c.user_a
        const p: any = peopleMap.get(otherId)
        return {
          id: c.id,
          other_id: otherId,
          other_name: p?.full_name || 'ผู้ใช้',
          other_avatar: p?.avatar_url ?? null,
          other_role: p?.role || 'owner',
          last_message: c.last_message,
          last_sender_id: c.last_sender_id,
          last_message_at: c.last_message_at,
          unread: unreadMap.get(c.id) || 0,
        }
      }))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingScreen />

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary-600" /> ข้อความ
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">แชทกับหมอและเจ้าของสัตว์เลี้ยงในระบบ</p>
      </div>

      {rows.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีข้อความ</p>
          <Link href="/vets" className="text-primary-500 text-sm mt-2 inline-block hover:underline">
            ไปหน้าค้นหาหมอ เพื่อเริ่มทักแชท
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <Link key={r.id} href={`/messages/${r.id}`}
              className="card flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className="shrink-0">
                {r.other_avatar ? (
                  <Image src={r.other_avatar} alt={r.other_name} width={48} height={48}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-100" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                    {r.other_name[0] || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold truncate">{r.other_name}</p>
                  {r.other_role !== 'owner' && (
                    <Stethoscope className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                  )}
                </div>
                <p className={`text-sm truncate ${r.unread > 0 ? 'text-gray-800 dark:text-gray-100 font-medium' : 'text-gray-400'}`}>
                  {r.last_message
                    ? `${r.last_sender_id && r.last_sender_id !== r.other_id ? 'คุณ: ' : ''}${r.last_message}`
                    : 'เริ่มการสนทนาได้เลย'}
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className="text-[10px] text-gray-400">{timeAgo(r.last_message_at)}</span>
                {r.unread > 0 ? (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                    {r.unread > 9 ? '9+' : r.unread}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
