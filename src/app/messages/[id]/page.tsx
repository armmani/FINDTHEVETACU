'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Stethoscope } from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'
import DirectChat from '@/components/DirectChat'
import { createNotification } from '@/lib/notifications'
import { notifyUser } from '@/lib/telegram'

interface Other {
  id: string
  full_name: string
  avatar_url: string | null
  role: string
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [me, setMe] = useState('')
  const [meName, setMeName] = useState('')
  const [other, setOther] = useState<Other | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMe(user.id)

      const { data: convo } = await supabase
        .from('conversations')
        .select('id, user_a, user_b')
        .eq('id', id)
        .single()

      if (!convo) { setLoading(false); return }

      const otherId = convo.user_a === user.id ? convo.user_b : convo.user_a
      const { data: people } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('id', [otherId, user.id])

      setOther(((people || []).find((p: any) => p.id === otherId) as Other) || null)
      setMeName(((people || []).find((p: any) => p.id === user.id) as any)?.full_name || '')
      setLoading(false)
    }
    load()
  }, [id])

  const handleSent = async (content: string) => {
    if (!other) return
    const preview = content.length > 60 ? `${content.slice(0, 60)}...` : content
    createNotification(other.id, `ข้อความใหม่จาก ${meName}`, preview, `/messages/${id}`)
    notifyUser(other.id, `💬 <b>ข้อความใหม่จาก ${meName}</b>\n\n${preview}`)
  }

  if (loading) return <LoadingScreen />
  if (!other) return <div className="text-center py-20 text-gray-400">ไม่พบห้องแชทนี้</div>

  const profileLink = other.role === 'owner' ? null : `/vets/${other.id}`

  return (
    <div className="max-w-lg mx-auto h-[calc(100vh-9rem)] sm:h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Link href="/messages" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {other.avatar_url ? (
          <Image src={other.avatar_url} alt={other.full_name} width={40} height={40}
            className="w-10 h-10 rounded-full object-cover border-2 border-gray-100" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
            {other.full_name[0] || '?'}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold truncate">{other.full_name}</h1>
            {other.role !== 'owner' && <Stethoscope className="w-4 h-4 text-primary-500 shrink-0" />}
          </div>
          {profileLink && (
            <Link href={profileLink} className="text-xs text-primary-600 hover:underline">ดูโปรไฟล์</Link>
          )}
        </div>
      </div>

      <div className="card flex-1 p-0 overflow-hidden flex flex-col">
        <DirectChat conversationId={id} currentUserId={me} onSent={handleSent} />
      </div>
    </div>
  )
}
