'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase'
import { Syringe, LogOut, User, History, Stethoscope, Home, Sun, Moon } from 'lucide-react'
import type { Profile } from '@/lib/types'

interface NavbarProps {
  profile: Profile
}

export default function Navbar({ profile }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const dashboardHref = profile.role === 'owner' ? '/owner/vets' : '/vet/dashboard'

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={dashboardHref} className="flex items-center gap-2 font-bold text-primary-600">
          <Syringe className="w-5 h-5" />
          VetAcu
        </Link>

        <div className="flex items-center gap-4">
          {profile.role === 'vet' && (
            <>
              <Link href="/vet/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <Home className="w-4 h-4" />
                <span className="hidden sm:block">หน้าหลัก</span>
              </Link>
              <Link href="/vet/history" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <History className="w-4 h-4" />
                <span className="hidden sm:block">ประวัติ</span>
              </Link>
              <Link href="/vet/profile" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <User className="w-4 h-4" />
                <span className="hidden sm:block">โปรไฟล์</span>
              </Link>
            </>
          )}
          {profile.role === 'owner' && (
            <>
              <Link href="/owner/vets" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <Stethoscope className="w-4 h-4" />
                <span className="hidden sm:block">ค้นหาหมอ</span>
              </Link>
              <Link href="/owner/settings" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <User className="w-4 h-4" />
                <span className="hidden sm:block">โปรไฟล์</span>
              </Link>
            </>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
            {profile.full_name && !profile.full_name.includes('@') ? profile.full_name : profile.full_name?.split('@')[0]}
          </span>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            title="เปลี่ยนธีม"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={handleSignOut} className="text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors" title="ออกจากระบบ">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
