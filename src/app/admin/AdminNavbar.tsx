'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Syringe, LogOut, LayoutDashboard } from 'lucide-react'

export default function AdminNavbar({ fullName }: { fullName: string }) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/admin/dashboard" className="flex items-center gap-2 font-bold text-primary-600">
          <Syringe className="w-5 h-5" />
          VetAcu <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Admin</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="text-sm text-gray-600 hover:text-primary-600 flex items-center gap-1">
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:block">Dashboard</span>
          </Link>
          <span className="text-sm text-gray-500 hidden sm:block">{fullName}</span>
          <button onClick={handleSignOut} className="text-gray-500 hover:text-red-500 transition-colors" title="ออกจากระบบ">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
