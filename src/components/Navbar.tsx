'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Syringe, LogOut, User, History, Bell, Stethoscope } from 'lucide-react'
import type { Profile } from '@/lib/types'

interface NavbarProps {
  profile: Profile
}

export default function Navbar({ profile }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const dashboardHref = profile.role === 'owner' ? '/owner/dashboard' : '/vet/dashboard'

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={dashboardHref} className="flex items-center gap-2 font-bold text-primary-600">
          <Syringe className="w-5 h-5" />
          VetAcu
        </Link>

        <div className="flex items-center gap-4">
          {profile.role === 'vet' && (
            <>
              <Link href="/vet/history" className="text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1">
                <History className="w-4 h-4" />
                <span className="hidden sm:block">ประวัติ</span>
              </Link>
              <Link href="/vet/profile" className="text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1">
                <User className="w-4 h-4" />
                <span className="hidden sm:block">โปรไฟล์</span>
              </Link>
            </>
          )}
          {profile.role === 'owner' && (
            <>
              <Link href="/owner/vets" className="text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1">
                <Stethoscope className="w-4 h-4" />
                <span className="hidden sm:block">หมอ</span>
              </Link>
              <Link href="/owner/history" className="text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1">
                <History className="w-4 h-4" />
                <span className="hidden sm:block">ประวัติ</span>
              </Link>
              <Link href="/owner/settings" className="text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:block">ตั้งค่า</span>
              </Link>
            </>
          )}
          {profile.full_name && !profile.full_name.includes('@') && (
            <span className="text-sm text-gray-500 hidden sm:block">{profile.full_name}</span>
          )}
          <button onClick={handleSignOut} className="text-gray-500 hover:text-red-500 transition-colors" title="ออกจากระบบ">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
