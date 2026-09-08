'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { MessageCircle } from 'lucide-react'

/** ไอคอนกล่องข้อความพร้อมตัวเลขข้อความที่ยังไม่ได้อ่าน */
export default function MessageBell() {
  const supabase = createClient()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let userId = ''

    const refresh = async () => {
      const { count } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
        .neq('sender_id', userId)
      setUnread(count || 0)
    }

    let channel: ReturnType<typeof supabase.channel> | null = null

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userId = user.id
      await refresh()

      channel = supabase
        .channel('dm-unread')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () => refresh())
        .subscribe()
    }
    init()

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  return (
    <Link href="/messages"
      className="relative p-1.5 rounded-lg text-gray-500 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title="ข้อความ">
      <MessageCircle className="w-4 h-4" />
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
