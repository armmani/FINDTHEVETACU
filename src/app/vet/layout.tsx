import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import Navbar from '@/components/Navbar'
import VetProfileGate from '@/components/VetProfileGate'
import { isVetProfileIncomplete } from '@/lib/vetProfile'
import type { Profile } from '@/lib/types'

export default async function VetLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !['vet', 'admin'].includes(profile.role)) redirect('/owner/dashboard')

  const { data: vp } = await supabase
    .from('vet_profiles')
    .select('full_name_en, license_number, license_doc_url, location_lat')
    .eq('user_id', user.id)
    .single()

  // เฉพาะ vet เท่านั้นที่ต้องกรอกโปรไฟล์ให้ครบ — admin ไม่ต้องมีโปรไฟล์หมอ
  const incomplete = profile.role === 'vet' && isVetProfileIncomplete(vp)

  return (
    <div className="min-h-screen">
      <VetProfileGate incomplete={incomplete} />
      <Navbar profile={profile as Profile} fullNameEn={vp?.full_name_en ?? null} />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 sm:pb-8">{children}</main>
    </div>
  )
}
