import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`)
  }

  // เก็บ session cookies ที่ Supabase set ระหว่าง exchangeCodeForSession
  const sessionCookies: { name: string; value: string; options?: any }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach((c: { name: string; value: string; options?: any }) => sessionCookies.push(c))
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`)
  }

  const user = data.user

  // helper: สร้าง redirect พร้อม session cookies
  const makeRedirect = (url: string) => {
    const res = NextResponse.redirect(url)
    sessionCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
    return res
  }

  // เส้นทางนี้มาจาก Google OAuth เสมอ — บันทึกไว้ให้ super_admin เห็นว่าสมัคร/ล็อกอินด้วยอะไร
  await supabase.from('profiles').update({ provider: 'google' }).eq('id', user.id)

  // ถ้ามี pending_oauth_role cookie (มาจากหน้าสมัคร)
  const pendingRole = request.cookies.get('pending_oauth_role')?.value
  if (pendingRole) {
    await supabase.from('profiles').update({ role: pendingRole }).eq('id', user.id)
    await supabase.auth.updateUser({ data: { role: pendingRole } })

    if (pendingRole === 'vet') {
      // สร้าง vet_profile เปล่าๆ ไว้ก่อน — ยังไม่แจ้ง admin จนกว่าจะกรอกโปรไฟล์และแนบใบอนุญาตจริง
      await supabase.from('vet_profiles').upsert({ user_id: user.id })
      const res = makeRedirect(`${origin}/vet/profile`)
      res.cookies.set('pending_oauth_role', '', { maxAge: 0, path: '/' })
      return res
    }

    const res = makeRedirect(`${origin}/home`)
    res.cookies.set('pending_oauth_role', '', { maxAge: 0, path: '/' })
    return res
  }

  // login ปกติ → ดู role จาก profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || user.user_metadata?.role

  if (role === 'super_admin') return makeRedirect(`${origin}/admin/dashboard`)
  return makeRedirect(`${origin}/home`)
}
