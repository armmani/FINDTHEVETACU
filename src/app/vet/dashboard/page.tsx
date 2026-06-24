'use client'

import { Calendar } from 'lucide-react'

export default function VetDashboard() {
  return (
    <div className="max-w-md mx-auto mt-16 text-center">
      <div className="card py-14 px-8">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold mb-2">ระบบคำขอนัดหมาย</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          ฟีเจอร์นี้ยังไม่เปิดให้บริการในขณะนี้
          <br />
          กำลังพัฒนาและจะเปิดให้ใช้งานเร็วๆ นี้
        </p>
        <div className="mt-6 inline-block bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium px-4 py-1.5 rounded-full">
          เร็วๆ นี้
        </div>
      </div>
    </div>
  )
}
