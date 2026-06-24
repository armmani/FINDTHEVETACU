'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      toast.error('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/FindTheVet.png" alt="FindTheVet" width={160} height={48} className="h-10 w-auto" />
          </div>
          <h1 className="text-2xl font-bold">ลืมรหัสผ่าน</h1>
          <p className="text-gray-500 text-sm mt-1">ระบบจะส่งลิงก์รีเซ็ตไปที่อีเมลของคุณ</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-5xl">📧</div>
            <p className="font-semibold">ส่งอีเมลแล้ว!</p>
            <p className="text-sm text-gray-500">ตรวจสอบอีเมล <strong>{email}</strong> แล้วกดลิงก์เพื่อตั้งรหัสผ่านใหม่</p>
            <p className="text-xs text-gray-400">ไม่เห็นอีเมล? เช็ค Spam/Junk ด้วย</p>
            <Link href="/auth/login" className="btn-secondary w-full flex items-center justify-center gap-2 mt-4">
              <ArrowLeft className="w-4 h-4" /> กลับหน้า Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="your@email.com"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}
            </button>
            <Link href="/auth/login" className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> กลับหน้า Login
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
