'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { openConversation } from '@/lib/chat'
import toast from 'react-hot-toast'

interface ChatButtonProps {
  targetUserId: string
  label?: string
  className?: string
}

/** ปุ่ม "ทักแชท" — เปิดห้องแชทกับผู้ใช้คนนั้นแล้วพาไปหน้าแชท */
export default function ChatButton({ targetUserId, label = 'ทักแชท', className = '' }: ChatButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    const id = await openConversation(targetUserId)
    setLoading(false)
    if (!id) { toast.error('เปิดแชทไม่ได้ — ผู้ใช้รายนี้ปิดรับข้อความอยู่'); return }
    router.push(`/messages/${id}`)
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading}
      className={`btn-primary flex items-center justify-center gap-2 disabled:opacity-50 ${className}`}>
      <MessageCircle className="w-4 h-4" />
      {loading ? 'กำลังเปิดแชท...' : label}
    </button>
  )
}
