'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'
import { LogOut, LayoutDashboard, Sun, Moon, Home } from 'lucide-react'
import Image from 'next/image'

export default function AdminNavbar({ fullName, role }: { fullName: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const { lang, setLang } = useLang()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <Image src="/FindTheVet.png" alt="FindTheVet" width={120} height={36} className="h-8 w-auto" />
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
        </Link>
        <div className="flex items-center gap-4">
          {role === 'super_admin' ? (
            <Link href="/admin/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:block">Dashboard</span>
            </Link>
          ) : (
            <Link href="/home" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
              <Home className="w-4 h-4" />
              <span className="hidden sm:block">กลับหน้าหลัก</span>
            </Link>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">{fullName}</span>
          <button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="text-xs font-bold px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors"
          >
            {lang === 'th' ? 'EN' : 'TH'}
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
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
