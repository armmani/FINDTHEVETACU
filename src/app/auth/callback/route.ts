import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const user = data.user

      // ถ้ามี pending_oauth_role cookie (มาจากหน้าสมัคร) ให้ใช้ role นั้น
      const pendingRole = cookieStore.get('pending_oauth_role')?.value

      if (pendingRole) {
        // ลบ cookie
        cookieStore.set('pending_oauth_role', '', { maxAge: 0, path: '/' })

        // อัปเดต role ใน profiles และ user_metadata
        await supabase.from('profiles').update({ role: pendingRole }).eq('id', user.id)
        await supabase.auth.updateUser({ data: { role: pendingRole } })

        if (pendingRole === 'vet') {
          await supabase.from('vet_profiles').upsert({ user_id: user.id })
          // แจ้ง admin ผ่าน telegram
          const name = user.user_metadata?.full_name || user.email || 'ไม่ระบุ'
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_CHAT_ID,
              text: `🩺 VetAcu — หมอใหม่รอยืนยัน!\n\n${name} สมัครด้วย Google\nกรุณาตรวจสอบใบอนุญาตและยืนยันตัวตนใน Admin Dashboard`,
              parse_mode: 'HTML',
            }),
          }).catch(() => {})
          return NextResponse.redirect(`${origin}/vet/profile`)
        }

        return NextResponse.redirect(`${origin}/vets`)
      }

      // ไม่มี cookie → login ปกติ → ดู role จาก profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role || user.user_metadata?.role
      if (role === 'vet') return NextResponse.redirect(`${origin}/vet/dashboard`)
      if (role === 'admin') return NextResponse.redirect(`${origin}/admin/dashboard`)
      return NextResponse.redirect(`${origin}/vets`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=oauth`)
}
