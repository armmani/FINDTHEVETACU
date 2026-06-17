'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Syringe } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัว'); return }
    if (password !== confirm) { toast.error('รหัสผ่านไม่ตรงกัน'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error('เปลี่ยนรหัสผ่านไม่สำเร็จ ลิงก์อาจหมดอายุแล้ว')
    } else {
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ!')
      router.push('/auth/login')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-primary-100 p-3 rounded-full">
              <Syringe className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1>
          <p className="text-gray-500 text-sm mt-1">กรอกรหัสผ่านใหม่ของคุณ</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">รหัสผ่านใหม่</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="อย่างน้อย 6 ตัวอักษร"
              required
            />
          </div>
          <div>
            <label className="label">ยืนยันรหัสผ่าน</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>
      </div>
    </div>
  )
}
