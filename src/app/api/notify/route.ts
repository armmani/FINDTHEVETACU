import { NextRequest, NextResponse } from 'next/server'

// Server-side route — token ไม่โดน expose ฝั่ง client
export async function POST(req: NextRequest) {
  const { chat_id, message } = await req.json()
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token || !chat_id || !message) {
    return NextResponse.json({ ok: false, reason: 'missing params' })
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text: message, parse_mode: 'HTML' }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: data.ok })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
