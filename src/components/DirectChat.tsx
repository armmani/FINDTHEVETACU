'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Send } from 'lucide-react'

interface DirectMessage {
  id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
}

interface DirectChatProps {
  conversationId: string
  currentUserId: string
  /** เรียกหลังส่งข้อความสำเร็จ เอาไว้ยิง notification ให้ปลายทาง */
  onSent?: (content: string) => void
}

export default function DirectChat({ conversationId, currentUserId, onSent }: DirectChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const markRead = useCallback(async () => {
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .is('read_at', null)
  }, [conversationId, currentUserId])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('direct_messages')
        .select('id, sender_id, content, read_at, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at')
      setMessages((data as DirectMessage[]) || [])
      markRead()
    }
    load()
  }, [conversationId, markRead])

  useEffect(() => {
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        const msg = payload.new as DirectMessage
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
        if (msg.sender_id !== currentUserId) markRead()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, currentUserId, markRead])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    const { data, error } = await supabase
      .from('direct_messages')
      .insert({ conversation_id: conversationId, sender_id: currentUserId, content })
      .select('id, sender_id, content, read_at, created_at')
      .single()
    setSending(false)
    if (error) return
    setText('')
    if (data) setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data as DirectMessage]))
    onSent?.(content)
  }

  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

  let lastDay = ''

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">เริ่มการสนทนาได้เลย</p>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUserId
          const day = dayLabel(msg.created_at)
          const showDay = day !== lastDay
          lastDay = day
          return (
            <div key={msg.id}>
              {showDay && (
                <div className="flex justify-center my-3">
                  <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-full">{day}</span>
                </div>
              )}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  isMe
                    ? 'bg-primary-500 text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm'
                }`}>
                  <p>{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    {isMe && msg.read_at && ' · อ่านแล้ว'}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-900">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input type="text" value={text} onChange={e => setText(e.target.value)}
            className="input flex-1 py-2 text-sm" placeholder="พิมพ์ข้อความ..." />
          <button type="submit" disabled={sending || !text.trim()}
            className="btn-primary px-3 py-2 shrink-0 disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
