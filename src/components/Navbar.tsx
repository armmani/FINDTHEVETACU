'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'
import { LogOut, User, Stethoscope, Sun, Moon, Building2, Hospital, ShieldCheck, PawPrint, ArrowLeftRight, ClipboardList, House, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Profile } from '@/lib/types'
import NotificationBell from '@/components/NotificationBell'

function MobileTab({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 text-[10px] font-medium transition-colors">
      {icon}
      <span>{label}</span>
    </Link>
  )
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <div className="relative h-9 flex items-center" style={{ width: '2.25rem' }}>
      <Link
        href={href}
        className="group nav-icon absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-lg px-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
      >
        <span className="shrink-0">{icon}</span>
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[6rem] transition-all duration-500 ease-out text-sm font-medium">
          {label}
        </span>
      </Link>
    </div>
  )
}

interface NavbarProps {
  profile: Profile
  fullNameEn?: string | null
  pendingCount?: number
}

export default function Navbar({ profile, fullNameEn, pendingCount = 0 }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t } = useLang()

  const [ownerMode, setOwnerMode] = useState(false)
  useEffect(() => {
    setOwnerMode(localStorage.getItem('vetOwnerMode') === '1')
  }, [])
  const toggleOwnerMode = () => {
    const next = !ownerMode
    setOwnerMode(next)
    localStorage.setItem('vetOwnerMode', next ? '1' : '0')
    router.push(next ? '/vets' : '/vet/opd')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-3 flex-1 sm:flex-none">
          <Link href="/home">
            <Image src="/FindTheVet.png" alt="FindTheVet" width={160} height={40} className="h-8 w-auto hidden sm:block" priority />
            <Image src="/logo-icon.png" alt="FindTheVet" width={32} height={32} className="h-8 w-8 block sm:hidden rounded-lg" priority />
          </Link>
          {profile.role === 'admin' && (
            <Link href="/admin/verify"
              className="relative flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium">
              <ShieldCheck className="w-5 h-5" />
              <span>ตรวจสอบ</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          )}
        </div>

        {/* Center: Nav links — desktop only */}
        <div className="flex-1 hidden sm:flex items-center justify-evenly">
          {(profile.role === 'vet' || profile.role === 'admin') && (
            <>
              {ownerMode ? (
                <>
                  <NavLink href="/vets" icon={<Stethoscope className="w-5 h-5" />} label={t.nav.findVet} />
                  <NavLink href="/clinics" icon={<Hospital className="w-5 h-5" />} label={t.nav.clinics} />
                  <NavLink href="/owner/pets" icon={<PawPrint className="w-5 h-5" />} label={t.nav.myPets} />
                  <NavLink href="/owner/settings" icon={<User className="w-5 h-5" />} label={t.nav.profile} />
                </>
              ) : (
                <>
                  <NavLink href="/vets" icon={<Stethoscope className="w-5 h-5" />} label={t.nav.findVet} />
                  <NavLink href="/clinics" icon={<Hospital className="w-5 h-5" />} label={t.nav.clinics} />
                  <NavLink href="/clinic/manage" icon={<House className="w-5 h-5" />} label={t.nav.myClinics} />
                  <NavLink href="/vet/opd" icon={<ClipboardList className="w-5 h-5" />} label="OPD" />
                  <NavLink href="/vet/profile" icon={<User className="w-5 h-5" />} label={t.nav.profile} />
                </>
              )}
              <button
                onClick={toggleOwnerMode}
                title={ownerMode ? 'สลับเป็นโหมดหมอ' : 'สลับเป็นโหมดเจ้าของสัตว์'}
                className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition-colors
                  ${ownerMode
                    ? 'border-primary-400 text-primary-600 bg-primary-50 dark:bg-primary-950 dark:text-primary-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600'
                  }`}
              >
                {ownerMode ? <Stethoscope className="w-3.5 h-3.5" /> : <PawPrint className="w-3.5 h-3.5" />}
                <span className="text-xs">{ownerMode ? 'หมอ' : 'เจ้าของ'}</span>
              </button>
            </>
          )}
          {profile.role === 'owner' && (
            <>
              <NavLink href="/vets" icon={<Stethoscope className="w-5 h-5" />} label={t.nav.findVet} />
              <NavLink href="/clinics" icon={<Hospital className="w-5 h-5" />} label={t.nav.clinics} />
              <NavLink href="/owner/pets" icon={<PawPrint className="w-5 h-5" />} label={t.nav.myPets} />
              <NavLink href="/owner/settings" icon={<User className="w-5 h-5" />} label={t.nav.profile} />
            </>
          )}
        </div>

        {/* Right: Utility buttons */}
        <div className="flex items-center shrink-0">

          {/* User first name — desktop only */}
          {profile.full_name && (
            <span className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 mr-2 max-w-[8rem] truncate">
              {profile.full_name.trim().split(/\s+/)[0]}
            </span>
          )}

          {/* Notification bell */}
          <NotificationBell />

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-2" />

          {/* Dark mode toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={t.nav.changeTheme}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button onClick={handleSignOut}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title={t.nav.signOut}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40 flex safe-area-inset-bottom">
        {(profile.role === 'vet' || profile.role === 'admin') && (ownerMode ? (
          <>
            <MobileTab href="/vets" icon={<Stethoscope className="w-5 h-5" />} label={t.nav.findVet} />
            <MobileTab href="/clinics" icon={<Hospital className="w-5 h-5" />} label={t.nav.clinics} />
            <MobileTab href="/owner/pets" icon={<PawPrint className="w-5 h-5" />} label={t.nav.myPets} />
            <MobileTab href="/owner/settings" icon={<User className="w-5 h-5" />} label={t.nav.profile} />
            <button onClick={toggleOwnerMode} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-primary-600 dark:text-primary-400 text-[10px] font-medium">
              <ArrowLeftRight className="w-5 h-5" />
              <span>โหมดหมอ</span>
            </button>
          </>
        ) : (
          <>
            <MobileTab href="/home" icon={<Search className="w-5 h-5" />} label="ค้นหา" />
            <MobileTab href="/vet/opd" icon={<ClipboardList className="w-5 h-5" />} label="OPD" />
            <MobileTab href="/clinic/manage" icon={<House className="w-5 h-5" />} label={t.nav.myClinics} />
            <MobileTab href="/vet/profile" icon={<User className="w-5 h-5" />} label={t.nav.profile} />
            <button onClick={toggleOwnerMode} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 text-[10px] font-medium transition-colors">
              <ArrowLeftRight className="w-5 h-5" />
              <span>เจ้าของ</span>
            </button>
          </>
        ))}
        {profile.role === 'owner' && (
          <>
            <MobileTab href="/vets" icon={<Stethoscope className="w-5 h-5" />} label={t.nav.findVet} />
            <MobileTab href="/clinics" icon={<Hospital className="w-5 h-5" />} label={t.nav.clinics} />
            <MobileTab href="/owner/pets" icon={<PawPrint className="w-5 h-5" />} label={t.nav.myPets} />
            <MobileTab href="/owner/settings" icon={<User className="w-5 h-5" />} label={t.nav.profile} />
          </>
        )}
      </div>
    </nav>
  )
}
