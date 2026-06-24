'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Syringe, PawPrint, Stethoscope, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Role } from '@/lib/types'
import { notifyAdmin } from '@/lib/telegram'

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>
}

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [role, setRole] = useState<Role>((params.get('role') as Role) || 'owner')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogleRegister = async () => {
    setGoogleLoading(true)
    // ส่ง role ผ่าน cookie ให้ callback route อ่าน
    document.cookie = `pending_oauth_role=${role}; path=/; max-age=300; SameSite=Lax`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setPendingUserId(data.user?.id || null)
    setStep('otp')
    toast.success('ส่งรหัสยืนยันไปที่อีเมลแล้ว กรุณาตรวจสอบ')
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: 'signup',
    })

    if (error) {
      toast.error('รหัสไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (!userId) { setLoading(false); return }

    // อัปเดต phone ถ้ามี
    if (phone) {
      await supabase.from('profiles').update({ phone }).eq('id', userId)
    }

    // ถ้าเป็นหมอ สร้าง vet_profile เปล่าๆ แล้วแจ้ง admin
    if (role === 'vet') {
      await supabase.from('vet_profiles').upsert({ user_id: userId })
      notifyAdmin(`🩺 <b>FindTheVet — หมอใหม่รอยืนยัน!</b>\n\n<b>${fullName}</b> สมัครเป็นสัตวแพทย์\nกรุณาตรวจสอบใบอนุญาตและยืนยันตัวตนใน Admin Dashboard`)
    }

    toast.success('ยืนยันอีเมลสำเร็จ!')
    router.push(role === 'vet' ? '/vet/profile' : '/home')
    router.refresh()
  }

  const handleResend = async () => {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) toast.error('ส่งอีกครั้งไม่ได้ กรุณารอสักครู่')
    else toast.success('ส่งรหัสใหม่แล้ว')
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="card w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="bg-primary-100 p-3 rounded-full">
                <Mail className="w-8 h-8 text-primary-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">ยืนยันอีเมล</h1>
            <p className="text-gray-500 text-sm mt-2">
              เราส่งรหัส 6 หลักไปที่<br />
              <span className="font-medium text-gray-700">{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="label">รหัสยืนยัน (OTP)</label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="input text-center text-2xl tracking-widest font-bold"
                placeholder="00000000"
                maxLength={8}
                required
                autoFocus
              />
            </div>

            <button type="submit" disabled={loading || otp.length < 6} className="btn-primary w-full py-2.5">
              {loading ? 'กำลังยืนยัน...' : 'ยืนยัน'}
            </button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button onClick={handleResend} className="text-sm text-primary-600 hover:underline">
              ส่งรหัสอีกครั้ง
            </button>
            <br />
            <button onClick={() => setStep('form')} className="text-sm text-gray-400 hover:text-gray-600">
              แก้ไขอีเมล
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="bg-primary-100 p-3 rounded-full">
              <Syringe className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">สมัครสมาชิก</h1>
        </div>

        {/* Role selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {([
            { value: 'owner', label: 'เจ้าของสัตว์', icon: PawPrint },
            { value: 'vet', label: 'สัตวแพทย์', icon: Stethoscope },
          ] as const).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors text-sm font-medium
                ${role === value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="label">ชื่อ-นามสกุล</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="input"
              placeholder="สมชาย ใจดี"
              required
            />
          </div>
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
          <div>
            <label className="label">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="input"
              placeholder="08x-xxx-xxxx"
            />
          </div>
          <div>
            <label className="label">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="อย่างน้อย 6 ตัวอักษร"
              minLength={6}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'กำลังส่งรหัสยืนยัน...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-400">
            <span className="bg-white px-3">หรือสมัครด้วย</span>
          </div>
        </div>

        <button onClick={handleGoogleRegister} disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? 'กำลังเชื่อมต่อ...' : 'สมัครด้วย Google'}
        </button>


        <p className="text-center text-sm text-gray-500 mt-4">
          มีบัญชีแล้ว?{' '}
          <Link href="/auth/login" className="text-primary-600 font-medium hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  )
}
