import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

export default async function ClinicsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'owner' && profile.role !== 'vet')) redirect('/auth/login')

  let fullNameEn: string | null = null
  if (profile.role === 'vet') {
    const { data: vp } = await supabase
      .from('vet_profiles')
      .select('full_name_en')
      .eq('user_id', user.id)
      .single()
    fullNameEn = vp?.full_name_en ?? null
  }

  return (
    <div className="min-h-screen">
      <Navbar profile={profile as Profile} fullNameEn={fullNameEn} />
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
