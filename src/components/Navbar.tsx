'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'
import { LogOut, User, Stethoscope, Home, Sun, Moon, Building2, ShieldCheck, Bell } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import type { Profile } from '@/lib/types'

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

  interface Notification { id: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string }
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const loadNotifs = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifications(data as Notification[])
    }
    loadNotifs()
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleOpenNotif = async () => {
    setShowNotif(v => !v)
    if (unreadCount > 0) {
      const ids = notifications.filter(n => !n.read).map(n => n.id)
      await supabase.from('notifications').update({ read: true }).in('id', ids)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/home">
          {/* mobile: icon only, desktop: full logo */}
          <Image src="/FindTheVet.png" alt="FindTheVet" width={160} height={40} className="h-8 w-auto hidden sm:block" priority />
          <Image src="/logo-icon.png" alt="FindTheVet" width={32} height={32} className="h-8 w-8 block sm:hidden rounded-lg" priority />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* admin badge — แสดงเฉพาะ role=admin */}
          {profile.role === 'admin' && (
            <Link href="/admin/verify"
              className="relative flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium">
              <ShieldCheck className="w-5 h-5" />
              <span className="hidden sm:block">ตรวจสอบ</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          )}
          {(profile.role === 'vet' || profile.role === 'admin') && (
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

          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleOpenNotif}
              className="relative text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              title="การแจ้งเตือน"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 top-8 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="font-semibold text-sm">การแจ้งเตือน</span>
                  {notifications.length > 0 && (
                    <button
                      onClick={async () => {
                        await supabase.from('notifications').delete().in('id', notifications.map(n => n.id))
                        setNotifications([])
                      }}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">ไม่มีการแจ้งเตือน</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => { if (n.link) router.push(n.link); setShowNotif(false) }}
                        className={`px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${n.link ? 'cursor-pointer' : ''} ${!n.read ? 'bg-primary-50 dark:bg-primary-950' : ''}`}
                      >
                        <p className={`text-sm font-medium ${!n.read ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>{n.title}</p>
                        {n.body && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
                          {new Date(n.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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
