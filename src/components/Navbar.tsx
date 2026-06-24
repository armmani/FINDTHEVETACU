'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'
import { Syringe, LogOut, User, Stethoscope, Home, Sun, Moon, Building2 } from 'lucide-react'
import type { Profile } from '@/lib/types'

interface NavbarProps {
  profile: Profile
  fullNameEn?: string | null
}

export default function Navbar({ profile, fullNameEn }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t } = useLang()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/home" className="flex items-center gap-2 font-bold text-primary-600">
          <Syringe className="w-5 h-5" />
          Thai acuPETure
        </Link>

        <div className="flex items-center gap-4">
          {profile.role === 'vet' && (
            <>
              <Link href="/vets" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <Stethoscope className="w-4 h-4" />
                <span className="hidden sm:block">{t.nav.findVet}</span>
              </Link>
              <Link href="/clinics" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:block">{t.nav.clinics}</span>
              </Link>
              <Link href="/vet/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <Home className="w-4 h-4" />
                <span className="hidden sm:block">{t.nav.dashboard}</span>
              </Link>
              <Link href="/clinic/manage" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:block">{t.nav.myClinics}</span>
              </Link>
              <Link href="/vet/profile" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <User className="w-4 h-4" />
                <span className="hidden sm:block">{t.nav.profile}</span>
              </Link>
            </>
          )}
          {profile.role === 'owner' && (
            <>
              <Link href="/vets" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <Stethoscope className="w-4 h-4" />
                <span className="hidden sm:block">{t.nav.findVet}</span>
              </Link>
              <Link href="/clinics" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:block">{t.nav.clinics}</span>
              </Link>
              <Link href="/owner/settings" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1">
                <User className="w-4 h-4" />
                <span className="hidden sm:block">{t.nav.profile}</span>
              </Link>
            </>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
            {lang === 'en' && fullNameEn
              ? fullNameEn
              : profile.full_name && !profile.full_name.includes('@')
                ? profile.full_name
                : profile.full_name?.split('@')[0]}
          </span>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="text-xs font-bold px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            title={t.nav.changeTheme}
          >
            {lang === 'th' ? 'EN' : 'TH'}
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            title={t.nav.changeTheme}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button onClick={handleSignOut} className="text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors" title={t.nav.signOut}>
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
