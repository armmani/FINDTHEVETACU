import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'owner') redirect('/vet/dashboard')

  return (
    <div className="min-h-screen">
      <Navbar profile={profile as Profile} />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 sm:pb-8">{children}</main>
    </div>
  )
}
