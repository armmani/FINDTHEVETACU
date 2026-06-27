import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')
  if (profile.role === 'super_admin') redirect('/admin/dashboard')
  if (!['owner', 'vet', 'admin'].includes(profile.role)) redirect('/auth/login')

  let fullNameEn: string | null = null
  if (profile.role === 'vet' || profile.role === 'admin') {
    const { data: vp } = await supabase
      .from('vet_profiles')
      .select('full_name_en')
      .eq('user_id', user.id)
      .single()
    fullNameEn = vp?.full_name_en ?? null
  }

  // นับ pending สำหรับ admin role
  let pendingCount = 0
  if (profile.role === 'admin') {
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      supabase.from('clinics').select('id', { count: 'exact', head: true }).in('status', ['pending', 'reviewing']),
      supabase.from('vet_profiles').select('user_id', { count: 'exact', head: true }).in('status', ['pending', 'reviewing']),
    ])
    pendingCount = (c1 || 0) + (c2 || 0)
  }

  return (
    <div className="min-h-screen">
      <Navbar profile={profile as Profile} fullNameEn={fullNameEn} pendingCount={pendingCount} />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 sm:pb-8">{children}</main>
    </div>
  )
}
