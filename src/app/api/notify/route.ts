import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

// Server-side route — token ไม่โดน expose ฝั่ง client
// กันสแปม: ต้องเป็นผู้ใช้ที่ล็อกอินแล้วเท่านั้น (ทุก caller ในแอปเป็น context ที่ล็อกอินอยู่แล้ว)
export async function POST(req: NextRequest) {
  // ตรวจ session — ปิดช่องให้คนนอกยิง /api/notify สแปมเข้า Telegram
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  } catch {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const { chat_id, message } = await req.json()
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token || !chat_id || !message) {
    return NextResponse.json({ ok: false, reason: 'missing params' })
  }

  // จำกัดความยาวข้อความ กันยิงเพย์โหลดใหญ่
  const text = String(message).slice(0, 2000)

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: data.ok })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
