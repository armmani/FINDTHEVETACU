import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`)
  }

  // สร้าง redirect response ก่อน แล้วค่อย set cookies ลงไปตรงๆ
  // เพื่อให้ cookies ถูกส่งกลับ browser พร้อมกับ redirect
  const redirectResponse = NextResponse.redirect(`${origin}/home`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`)
  }

  const user = data.user

  // ถ้ามี pending_oauth_role cookie (มาจากหน้าสมัคร) ให้ใช้ role นั้น
  const pendingRole = request.cookies.get('pending_oauth_role')?.value

  if (pendingRole) {
    redirectResponse.cookies.set('pending_oauth_role', '', { maxAge: 0, path: '/' })

    await supabase.from('profiles').update({ role: pendingRole }).eq('id', user.id)
    await supabase.auth.updateUser({ data: { role: pendingRole } })

    if (pendingRole === 'vet') {
      await supabase.from('vet_profiles').upsert({ user_id: user.id })
      const name = user.user_metadata?.full_name || user.email || 'ไม่ระบุ'
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_CHAT_ID,
          text: `🩺 FindTheVet — หมอใหม่รอยืนยัน!\n\n${name} สมัครด้วย Google\nกรุณาตรวจสอบใบอนุญาตและยืนยันตัวตนใน Admin Dashboard`,
          parse_mode: 'HTML',
        }),
      }).catch(() => {})
      redirectResponse.headers.set('Location', `${origin}/vet/profile`)
      return redirectResponse
    }

    redirectResponse.headers.set('Location', `${origin}/home`)
    return redirectResponse
  }

  // login ปกติ → ดู role จาก profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || user.user_metadata?.role
  if (role === 'admin') {
    redirectResponse.headers.set('Location', `${origin}/admin/dashboard`)
  }

  return redirectResponse
}
