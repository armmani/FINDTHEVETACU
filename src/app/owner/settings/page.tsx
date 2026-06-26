'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Save, Send, User, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import PhotoUpload from '@/components/PhotoUpload'
import { formatPhone } from '@/lib/formatPhone'

export default function OwnerSettingsPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string>('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [lineId, setLineId] = useState('')
  const [address, setAddress] = useState('')
  const [chatId, setChatId] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setEmail(user.email || '')
      const { data } = await supabase.from('profiles')
        .select('full_name, phone, line_id, address, telegram_chat_id, avatar_url')
        .eq('id', user.id).single()
      if (data) {
        setFullName((data as any).full_name || '')
        setPhone(formatPhone((data as any).phone || ''))
        setLineId((data as any).line_id || '')
        setAddress((data as any).address || '')
        setChatId((data as any).telegram_chat_id || '')
        setAvatarUrl((data as any).avatar_url || null)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({
      full_name: fullName,
      phone: phone || null,
      line_id: lineId || null,
      address: address || null,
      telegram_chat_id: chatId || null,
      avatar_url: avatarUrl || null,
    }).eq('id', user.id)
    if (error) toast.error('บันทึกไม่สำเร็จ')
    else toast.success('บันทึกแล้ว!')
    setSaving(false)
  }

  const handleTest = async () => {
    if (!chatId.trim()) { toast.error('กรุณากรอก Chat ID ก่อน'); return }
    setTesting(true)
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message: '✅ <b>FindTheVet</b>\nเชื่อมต่อ Telegram สำเร็จแล้ว! คุณจะได้รับการแจ้งเตือนที่นี่' }),
    })
    const data = await res.json()
    if (data.ok) toast.success('ส่งข้อความทดสอบแล้ว ตรวจสอบ Telegram!')
    else toast.error('ส่งไม่ได้ ตรวจสอบ Chat ID อีกครั้ง')
    setTesting(false)
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    if (newPassword !== confirmPassword) { toast.error('รหัสผ่านไม่ตรงกัน'); return }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error('เปลี่ยนรหัสผ่านไม่สำเร็จ')
    else { toast.success('เปลี่ยนรหัสผ่านแล้ว!'); setNewPassword(''); setConfirmPassword('') }
    setChangingPassword(false)
  }

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold">การตั้งค่า</h1>

      {/* รูปโปรไฟล์ */}
      <div className="card flex flex-col items-center">
        <h2 className="font-semibold text-gray-800 mb-4 self-start">รูปโปรไฟล์</h2>
        {userId && (
          <PhotoUpload
            bucket="avatars"
            currentUrl={avatarUrl}
            userId={userId}
            onUploaded={url => setAvatarUrl(url)}
            size="lg"
            shape="circle"
            label="คลิกเพื่อเปลี่ยนรูป"
          />
        )}
      </div>

      {/* ข้อมูลส่วนตัว */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <User className="w-4 h-4" /> ข้อมูลส่วนตัว
        </h2>
        <div>
          <label className="label">อีเมล</label>
          <input type="email" value={email} className="input bg-gray-50 text-gray-400 cursor-not-allowed" disabled />
          <p className="text-xs text-gray-400 mt-0.5">ไม่สามารถเปลี่ยนอีเมลได้</p>
        </div>
        <div>
          <label className="label">ชื่อ-นามสกุล</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            className="input" placeholder="สมชาย ใจดี" />
        </div>
        <div>
          <label className="label">เบอร์โทรศัพท์</label>
          <input type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
            className="input" placeholder="08x-xxx-xxxx" inputMode="numeric" />
        </div>
        <div>
          <label className="label">Line ID</label>
          <input type="text" value={lineId} onChange={e => setLineId(e.target.value)}
            className="input" placeholder="@yourlineid" />
        </div>
        <div>
          <label className="label">ที่อยู่</label>
          <textarea value={address} onChange={e => setAddress(e.target.value)}
            className="input resize-none" rows={2} placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด" />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>

      {/* เปลี่ยนรหัสผ่าน */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Lock className="w-4 h-4" /> เปลี่ยนรหัสผ่าน
        </h2>
        <div>
          <label className="label">รหัสผ่านใหม่</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
            className="input" placeholder="อย่างน้อย 6 ตัวอักษร" />
        </div>
        <div>
          <label className="label">ยืนยันรหัสผ่านใหม่</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            className="input" placeholder="พิมพ์รหัสผ่านอีกครั้ง" />
        </div>
        <button onClick={handleChangePassword} disabled={changingPassword || !newPassword}
          className="btn-primary w-full flex items-center justify-center gap-2">
          <Lock className="w-4 h-4" />
          {changingPassword ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
        </button>
      </div>

      {/* Telegram */}
      <div className="card space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✈️</span>
          <div>
            <p className="font-semibold">แจ้งเตือนผ่าน Telegram</p>
            <p className="text-sm text-gray-500">รับการแจ้งเตือนเมื่อหมอรับงาน ยืนยัน หรือยกเลิก</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-2">
          <p className="font-semibold">วิธีหา Chat ID ของคุณ</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-600">
            <li>เปิด Telegram แล้วค้นหา <strong>@VETACU_BOT</strong></li>
            <li>กด Start หรือพิมพ์ <code className="bg-blue-100 px-1 rounded">/start</code></li>
            <li>ไปที่ <strong>@userinfobot</strong> แล้วกด Start</li>
            <li>คัดลอก <strong>ID</strong> ที่ได้มาวางด้านล่าง</li>
          </ol>
        </div>
        <div>
          <label className="label">Telegram Chat ID</label>
          <input type="text" value={chatId} onChange={e => setChatId(e.target.value)}
            className="input" placeholder="เช่น 123456789" />
        </div>
        <div className="flex gap-3">
          <button onClick={handleTest} disabled={testing} className="btn-secondary flex items-center gap-2 flex-1">
            <Send className="w-4 h-4" />
            {testing ? 'กำลังส่ง...' : 'ทดสอบส่งข้อความ'}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 flex-1">
            <Save className="w-4 h-4" />
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}
