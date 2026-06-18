'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Send, Clock, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Message {
  id: string
  sender_id: string
  content: string
  type: 'text' | 'time_proposal' | 'time_accepted' | 'time_rejected'
  proposed_datetime: string | null
  created_at: string
  profiles?: { full_name: string }
}

interface AppointmentChatProps {
  appointmentId: string
  currentUserId: string
  role: 'owner' | 'vet'
  currentDatetime: string
  onTimeAccepted?: (newDatetime: string) => void
}

export default function AppointmentChat({
  appointmentId, currentUserId, role, currentDatetime, onTimeAccepted
}: AppointmentChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [proposedTime, setProposedTime] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadMessages() }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`apt-chat-${appointmentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'appointment_messages',
        filter: `appointment_id=eq.${appointmentId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [appointmentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    const { data } = await supabase
      .from('appointment_messages')
      .select('*, profiles:sender_id(full_name)')
      .eq('appointment_id', appointmentId)
      .order('created_at')
    setMessages((data as Message[]) || [])
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    await supabase.from('appointment_messages').insert({
      appointment_id: appointmentId,
      sender_id: currentUserId,
      content: text.trim(),
      type: 'text',
    })
    setText('')
    setSending(false)
  }

  const sendTimeProposal = async () => {
    if (!proposedTime) { toast.error('กรุณาเลือกเวลา'); return }
    setSending(true)
    const dt = new Date(proposedTime).toISOString()
    await supabase.from('appointment_messages').insert({
      appointment_id: appointmentId,
      sender_id: currentUserId,
      content: `เสนอเวลาใหม่: ${formatDT(dt)}`,
      type: 'time_proposal',
      proposed_datetime: dt,
    })
    setShowTimePicker(false)
    setProposedTime('')
    setSending(false)
  }

  const handleAcceptTime = async (msg: Message) => {
    if (!msg.proposed_datetime) return
    await Promise.all([
      supabase.from('appointments').update({ preferred_datetime: msg.proposed_datetime, proposed_datetime: msg.proposed_datetime }).eq('id', appointmentId),
      supabase.from('appointment_messages').insert({
        appointment_id: appointmentId,
        sender_id: currentUserId,
        content: `✅ ยอมรับเวลาใหม่: ${formatDT(msg.proposed_datetime)}`,
        type: 'time_accepted',
      }),
    ])
    toast.success('ยืนยันเวลาใหม่แล้ว')
    onTimeAccepted?.(msg.proposed_datetime)
  }

  const handleRejectTime = async (msg: Message) => {
    await supabase.from('appointment_messages').insert({
      appointment_id: appointmentId,
      sender_id: currentUserId,
      content: '❌ ปฏิเสธเวลาที่เสนอ',
      type: 'time_rejected',
    })
    toast.success('ปฏิเสธแล้ว')
  }

  const formatDT = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  const minDatetime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">เริ่มการสนทนาได้เลย</p>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUserId
          const name = (msg.profiles as any)?.full_name || ''

          if (msg.type === 'time_proposal') {
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-xs bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                    <Clock className="w-4 h-4" /> เสนอเวลาใหม่
                  </div>
                  <p className="text-sm font-medium text-gray-800">
                    {msg.proposed_datetime ? formatDT(msg.proposed_datetime) : ''}
                  </p>
                  {!isMe && role === 'owner' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleAcceptTime(msg)}
                        className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white text-xs py-1.5 rounded-lg hover:bg-green-600">
                        <Check className="w-3.5 h-3.5" /> ยอมรับ
                      </button>
                      <button onClick={() => handleRejectTime(msg)}
                        className="flex-1 flex items-center justify-center gap-1 bg-red-100 text-red-600 text-xs py-1.5 rounded-lg hover:bg-red-200">
                        <X className="w-3.5 h-3.5" /> ปฏิเสธ
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">{name}</p>
                </div>
              </div>
            )
          }

          if (msg.type === 'time_accepted' || msg.type === 'time_rejected') {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className={`text-xs px-3 py-1 rounded-full ${
                  msg.type === 'time_accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {msg.content}
                </span>
              </div>
            )
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                isMe ? 'bg-primary-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {!isMe && <p className="text-xs text-gray-500 mb-1">{name}</p>}
                <p>{msg.content}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-primary-200' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Time picker modal */}
      {showTimePicker && (
        <div className="border-t border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <Clock className="w-4 h-4" /> เสนอเวลาใหม่
          </p>
          <input type="datetime-local" value={proposedTime} min={minDatetime}
            onChange={e => setProposedTime(e.target.value)}
            className="input w-full" />
          <div className="flex gap-2">
            <button onClick={() => setShowTimePicker(false)}
              className="btn-secondary flex-1 text-sm py-2">ยกเลิก</button>
            <button onClick={sendTimeProposal} disabled={sending || !proposedTime}
              className="btn-primary flex-1 text-sm py-2">ส่งข้อเสนอ</button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-100 p-3 bg-white">
        {role === 'vet' && !showTimePicker && (
          <button onClick={() => setShowTimePicker(true)}
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 mb-2">
            <Clock className="w-3.5 h-3.5" /> เสนอเวลาใหม่
          </button>
        )}
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text" value={text} onChange={e => setText(e.target.value)}
            className="input flex-1 py-2 text-sm" placeholder="พิมพ์ข้อความ..."
          />
          <button type="submit" disabled={sending || !text.trim()}
            className="btn-primary px-3 py-2 shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
