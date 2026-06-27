'use client'

import LoadingScreen from '@/components/LoadingScreen'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Send, Calendar, MapPin } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Message {
  id: string
  booking_id: string
  sender_id: string
  content: string
  created_at: string
  profiles?: { full_name: string }
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const bookingId = params.bookingId as string
  const supabase = createClient()

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [petName, setPetName] = useState('')
  const [petType, setPetType] = useState('')
  const [otherName, setOtherName] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let aborted = false

    // สร้าง channel ก่อน (synchronous) เพื่อให้ cleanup ล้างได้เสมอ
    const channel = supabase
      .channel(`chat-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
        async (payload) => {
          if (aborted) return
          const { data: sender } = await supabase
            .from('profiles').select('full_name').eq('id', (payload.new as Message).sender_id).single()
          setMessages(prev => [...prev, { ...payload.new as Message, profiles: sender || undefined }])
        }
      )
      .subscribe()

    // โหลดข้อมูลแบบ async แยกต่างหาก
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || aborted) { if (!user) router.push('/auth/login'); return }
      setCurrentUserId(user.id)

      const [{ data: profile }, { data: booking }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase.from('bookings').select(`
          vet_id,
          appointments (
            pet_name, pet_type, preferred_datetime, location_address, owner_id,
            owner_profile:owner_id (full_name)
          )
        `).eq('id', bookingId).single(),
      ])

      if (aborted) return
      if (!booking) { router.push('/'); return }

      setCurrentRole(profile?.role || null)

      const apt = booking.appointments as any
      const { data: vetProfile } = await supabase.from('profiles').select('full_name').eq('id', booking.vet_id).single()
      if (aborted) return

      setPetName(apt?.pet_name || '')
      setPetType(apt?.pet_type || '')
      setAppointmentDate(apt?.preferred_datetime || '')
      setLocationAddress(apt?.location_address || '')
      setOtherName(user.id === booking.vet_id
        ? apt?.owner_profile?.full_name || 'เจ้าของ'
        : vetProfile?.full_name || 'หมอ'
      )

      const { data: msgs } = await supabase
        .from('messages').select('*, profiles:sender_id (full_name)')
        .eq('booking_id', bookingId).order('created_at', { ascending: true })
      if (!aborted) { setMessages(msgs || []); setLoading(false) }
    }

    loadData()

    return () => {
      aborted = true
      supabase.removeChannel(channel)
    }
  }, [bookingId])

  // เลื่อนลงล่างสุดเมื่อมีข้อความใหม่
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUserId) return
    setSending(true)

    const { error } = await supabase.from('messages').insert({
      booking_id: bookingId,
      sender_id: currentUserId,
      content: newMessage.trim(),
    })

    if (error) {
      toast.error('ส่งข้อความไม่ได้: ' + error.message)
    } else {
      setNewMessage('')
    }
    setSending(false)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  const backHref = currentRole === 'vet' ? '/vet/dashboard' : '/owner/dashboard'

  if (loading) return <LoadingScreen />

  return (
    <div className="max-w-lg mx-auto flex flex-col" style={{ height: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <div className="card mb-3 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href={backHref} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <p className="font-bold">{otherName}</p>
            <p className="text-xs text-gray-500">{petName} ({petType})</p>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
            ยืนยันแล้ว
          </span>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {appointmentDate ? formatDate(appointmentDate) : '-'}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="line-clamp-1">{locationAddress}</span>
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 px-1 pb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">
            <p>เริ่มการสนทนากับอีกฝ่ายได้เลย</p>
            <p className="text-xs mt-1">สอบถามเรื่องสถานที่ เวลา หรืออื่นๆ</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-primary-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                {!isMe && (
                  <p className="text-xs font-semibold mb-1 opacity-60">
                    {(msg.profiles as any)?.full_name}
                  </p>
                )}
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-primary-100 text-right' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-gray-100">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          className="input flex-1"
          placeholder="พิมพ์ข้อความ..."
          disabled={sending}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="btn-primary px-4 flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
