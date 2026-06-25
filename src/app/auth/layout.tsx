'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const prev = theme
    setTheme('light')
    return () => { if (prev) setTheme(prev) }
  }, [])

  return <>{children}</>
}
