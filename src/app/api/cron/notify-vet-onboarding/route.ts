import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function notifyTelegram(chatId: string, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  })
}

// เตือนหมอที่สมัครแล้วแต่โปรไฟล์ยังไม่ครบ (ไม่มีเลขใบอนุญาต / พิกัด / เอกสาร) เกิน 2 วัน
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

  const { data: stuckVets, error: stuckVetsError } = await supabaseAdmin
    .from('vet_profiles')
    .select('user_id, license_number, license_doc_url, location_lat, profiles!inner(full_name, telegram_chat_id, created_at)')
    .eq('status', 'pending')
    .lte('profiles.created_at', twoDaysAgo)
    .or('license_number.is.null,location_lat.is.null,license_doc_url.is.null')

  if (stuckVetsError) {
    console.error('[notify-vet-onboarding] query failed', stuckVetsError)
    return NextResponse.json({ ok: false, error: stuckVetsError.message }, { status: 500 })
  }

  const incomplete = (stuckVets || []).filter((v: any) =>
    !v.license_number || !v.location_lat || !v.license_doc_url
  )

  let notified = 0
  for (const v of incomplete as any[]) {
    // แจ้งเตือนในแอปให้หมอเอง (bell icon) — เช็คก่อนว่าเพิ่งเตือนไปหรือยังใน 3 วันล่าสุด กันสแปม
    const { count } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', v.user_id)
      .eq('title', '📋 กรอกโปรไฟล์ให้ครบเพื่อเริ่มรับงาน')
      .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from('notifications').insert({
        user_id: v.user_id,
        title: '📋 กรอกโปรไฟล์ให้ครบเพื่อเริ่มรับงาน',
        body: 'คุณสมัครเป็นสัตวแพทย์แล้วแต่ยังกรอกข้อมูลไม่ครบ กดเพื่อกรอกเลขใบอนุญาต ที่ตั้ง และแนบเอกสารยืนยันตัวตน',
        link: '/vet/profile',
      })
      notified++
    }

    // เตือนหมอเองทาง Telegram ถ้าเคยผูก chat id ไว้แล้ว
    const chatId = v.profiles?.telegram_chat_id
    if (chatId) {
      await notifyTelegram(chatId, `📋 <b>FindTheVet</b>\n\nคุณสมัครเป็นสัตวแพทย์แล้วแต่ยังกรอกโปรไฟล์ไม่ครบ กรุณาเข้าไปกรอกเลขใบอนุญาต ที่ตั้ง และแนบเอกสารยืนยันตัวตน เพื่อเริ่มรับงานได้ครับ`)
    }
  }

  // สรุปให้ admin ทาง Telegram — เผื่อหมอไม่มี chat id ให้เตือน จะได้ติดต่อเองทางอื่น
  const adminChatId = process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_CHAT_ID
  if (adminChatId && incomplete.length > 0) {
    const lines = incomplete.slice(0, 15).map((v: any) => {
      const daysAgo = Math.floor((Date.now() - new Date(v.profiles.created_at).getTime()) / 86400000)
      return `• ${v.profiles?.full_name || '(ไม่มีชื่อ)'} — สมัครมา ${daysAgo} วันแล้ว${v.profiles?.telegram_chat_id ? '' : ' (ไม่มี Telegram ติดต่อ)'}`
    }).join('\n')
    await notifyTelegram(adminChatId, `⏳ <b>FindTheVet — หมอค้างกรอกโปรไฟล์ ${incomplete.length} คน</b>\n\n${lines}`)
  }

  return NextResponse.json({ ok: true, stuck: incomplete.length, notified, checkedAt: new Date().toISOString() })
}
