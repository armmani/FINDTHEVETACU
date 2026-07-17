'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// บังคับหมอที่โปรไฟล์ยังไม่ครบ (ยังไม่มีเลขใบอนุญาต/พิกัด/เอกสาร) ให้กลับไปกรอกให้เสร็จก่อน
// เว้นหน้า /vet/profile เอง ไม่งั้นจะเด้งวนไม่รู้จบ
export default function VetProfileGate({ incomplete }: { incomplete: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (incomplete && pathname !== '/vet/profile') {
      router.replace('/vet/profile')
    }
  }, [incomplete, pathname, router])

  return null
}
