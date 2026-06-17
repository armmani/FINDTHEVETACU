'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Save, Send } from 'lucide-react'
import toast from 'react-hot-toast'

export default function OwnerSettingsPage() {
  const supabase = createClient()
  const [chatId, setChatId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('telegram_chat_id').eq('id', user.id).single()
      setChatId((data as any)?.telegram_chat_id || '')
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({ telegram_chat_id: chatId || null }).eq('id', user.id)
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
      body: JSON.stringify({ chat_id: chatId, message: '✅ <b>VetAcu</b>\nเชื่อมต่อ Telegram สำเร็จแล้ว! คุณจะได้รับการแจ้งเตือนที่นี่' }),
    })
    const data = await res.json()
    if (data.ok) toast.success('ส่งข้อความทดสอบแล้ว ตรวจสอบ Telegram!')
    else toast.error('ส่งไม่ได้ ตรวจสอบ Chat ID อีกครั้ง')
    setTesting(false)
  }

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">การแจ้งเตือน</h1>

      <div className="card space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✈️</span>
          <div>
            <p className="font-semibold">แจ้งเตือนผ่าน Telegram</p>
            <p className="text-sm text-gray-500">รับการแจ้งเตือนเมื่อหมอรับงาน ยืนยัน หรือยกเลิก</p>
          </div>
        </div>

        {/* วิธีหา Chat ID */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-2">
          <p className="font-semibold">วิธีหา Chat ID ของคุณ</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-600">
            <li>เปิด Telegram แล้วค้นหา <strong>@VETACU_BOT</strong></li>
            <li>กด Start หรือพิมพ์ <code className="bg-blue-100 px-1 rounded">/start</code></li>
            <li>ไปที่ <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline font-medium">@userinfobot</a> แล้วกด Start</li>
            <li>คัดลอก <strong>Id</strong> ที่ได้มาวางด้านล่าง</li>
          </ol>
        </div>

        <div>
          <label className="label">Telegram Chat ID</label>
          <input
            type="text"
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            className="input"
            placeholder="เช่น 123456789"
          />
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
