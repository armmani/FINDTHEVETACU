'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Phone, Shield, Search, ClipboardList, Building2, UserCircle } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

export default function LandingPage() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const prev = theme
    setTheme('light')
    return () => { if (prev) setTheme(prev) }
  }, [])

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy-700 to-navy-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <div className="flex justify-center mb-8">
            <Image src="/FindTheVet.png" alt="FindTheVet" width={280} height={100} className="h-32 w-auto brightness-0 invert" priority />
          </div>
          <p className="text-xl md:text-2xl text-primary-100 mb-2">
            สัตวแพทย์ไหนดี? เราช่วยคุณหาได้
          </p>
          <p className="text-primary-200 mb-10 max-w-xl mx-auto">
            ค้นหาสัตวแพทย์และคลินิกใกล้บ้าน ดูโปรไฟล์ ใบอนุญาต และตารางออกตรวจได้เลย
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register?role=owner" className="bg-white text-navy-700 font-bold py-3 px-8 rounded-xl hover:bg-gray-100 transition-colors">
              ฉันเป็นเจ้าของสัตว์
            </Link>
            <Link href="/auth/register?role=vet" className="bg-primary-500 text-white font-bold py-3 px-8 rounded-xl border-2 border-white/30 hover:bg-primary-400 transition-colors">
              ฉันเป็นสัตวแพทย์
            </Link>
          </div>
          <p className="mt-6 text-gray-300 text-sm">
            มีบัญชีแล้ว?{' '}
            <Link href="/auth/login" className="underline hover:text-white">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-2xl font-bold text-center mb-12 text-gray-900">วิธีการใช้งาน</h2>
        <div className="grid md:grid-cols-2 gap-8">

          {/* เจ้าของสัตว์ */}
          <div className="bg-gray-50 rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">🐾</span>
              <h3 className="text-lg font-bold text-gray-900">สำหรับเจ้าของสัตว์</h3>
            </div>
            <div className="space-y-5">
              {[
                { icon: Search, step: '1', title: 'ค้นหาหมอใกล้คุณ', desc: 'ค้นหาสัตวแพทย์ฝังเข็มตามจังหวัด ดูโปรไฟล์และตารางออกตรวจ' },
                { icon: Shield, step: '2', title: 'ตรวจสอบใบอนุญาต', desc: 'หมอทุกคนแสดงเลขใบอนุญาต พร้อมลิงก์ตรวจสอบจากสัตวแพทยสภา' },
                { icon: Phone, step: '3', title: 'ติดต่อหมอได้เลย', desc: 'ดูเบอร์โทรและตารางออกตรวจ แล้วติดต่อนัดหมายโดยตรง' },
              ].map(({ icon: Icon, step, title, desc }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm relative">
                    <Icon className="w-5 h-5 text-primary-600" />
                    <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{step}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{title}</p>
                    <p className="text-gray-500 text-xs leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* สัตวแพทย์ */}
          <div className="bg-primary-50 rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">🩺</span>
              <h3 className="text-lg font-bold text-gray-900">สำหรับสัตวแพทย์</h3>
            </div>
            <div className="space-y-5">
              {[
                { icon: UserCircle, step: '1', title: 'สร้างโปรไฟล์หมอ', desc: 'กรอกข้อมูล ใบอนุญาต ตารางออกตรวจ และประวัติการฝึกอบรม' },
                { icon: Building2, step: '2', title: 'เพิ่มคลินิก / รพ.สัตว์', desc: 'ลงทะเบียนสถานพยาบาลที่ทำงาน รอ Admin ตรวจสอบและอนุมัติ' },
                { icon: ClipboardList, step: '3', title: 'บันทึก OPD', desc: 'จัดการข้อมูลสัตว์ป่วย บันทึกการรักษา และติดตามผลในระบบ' },
              ].map(({ icon: Icon, step, title, desc }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm relative">
                    <Icon className="w-5 h-5 text-primary-600" />
                    <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{step}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{title}</p>
                    <p className="text-gray-500 text-xs leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        © 2026 FindTheVet — สัตวแพทย์ไหนดี
      </footer>
    </main>
  )
}
