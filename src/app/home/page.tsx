'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Search, Building2 } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      {/* Logo */}
      <div className="mb-6">
        <Image src="/FindTheVet.png" alt="FindTheVet" width={220} height={80} className="h-32 w-auto" priority />
      </div>

      <p className="text-gray-700 dark:text-gray-300 text-xl font-semibold mb-2">
        ค้นหาสัตวแพทย์ฝังเข็ม ได้ที่นี่
      </p>
      <p className="text-gray-400 text-sm mb-10 max-w-sm leading-relaxed">
        รวมสัตวแพทย์ฝังเข็มที่ผ่านการยืนยัน พร้อมตารางออกตรวจ<br />และคลินิกสัตว์ทั่วประเทศ
      </p>

      {/* 2 Big Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link href="/vets"
          className="flex-1 flex flex-col items-center gap-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl px-6 py-8 transition-colors shadow-md">
          <Search className="w-8 h-8" />
          <div>
            <p className="font-bold text-lg">ค้นหาหมอ</p>
            <p className="text-primary-200 text-xs mt-0.5">ดูโปรไฟล์และตารางออกตรวจ</p>
          </div>
        </Link>

        <Link href="/clinics"
          className="flex-1 flex flex-col items-center gap-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-2 border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300 rounded-2xl px-6 py-8 transition-colors shadow-md">
          <Building2 className="w-8 h-8" />
          <div>
            <p className="font-bold text-lg">ค้นหาคลินิก / รพ.สัตว์</p>
            <p className="text-gray-400 text-xs mt-0.5">คลินิกและโรงพยาบาลสัตว์</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
