import Link from 'next/link'
import { Syringe, Clock, MapPin, Shield, Search } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-white/20 p-4 rounded-full">
              <Syringe className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">VetAcu</h1>
          <p className="text-xl md:text-2xl text-primary-100 mb-2">
            ค้นหาสัตวแพทย์ฝังเข็ม ใกล้บ้านคุณ
          </p>
          <p className="text-primary-200 mb-10 max-w-xl mx-auto">
            ดูตารางออกตรวจตามเขต/จังหวัด เลือกหมอที่ไว้ใจ — นัดออกตรวจถึงบ้าน หรือไปพบที่คลินิก ง่าย ปลอดภัย
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register?role=owner" className="bg-white text-primary-700 font-bold py-3 px-8 rounded-xl hover:bg-primary-50 transition-colors">
              ฉันเป็นเจ้าของสัตว์
            </Link>
            <Link href="/auth/register?role=vet" className="bg-primary-500 text-white font-bold py-3 px-8 rounded-xl border-2 border-white/30 hover:bg-primary-400 transition-colors">
              ฉันเป็นสัตวแพทย์
            </Link>
          </div>
          <p className="mt-6 text-primary-200 text-sm">
            มีบัญชีแล้ว?{' '}
            <Link href="/auth/login" className="underline hover:text-white">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-2xl font-bold text-center mb-12">วิธีการใช้งาน</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Search,
              step: '1',
              title: 'ค้นหาหมอใกล้คุณ',
              desc: 'ค้นหาสัตวแพทย์ฝังเข็มตามจังหวัดหรือเขต ดูโปรไฟล์และตารางออกตรวจของแต่ละหมอ',
            },
            {
              icon: Clock,
              step: '2',
              title: 'นัดหมายตามสะดวก',
              desc: 'เลือกหมอที่ชอบแล้วส่งคำขอนัด — ให้หมอมาถึงบ้าน หรือไปพบที่คลินิกตามตาราง',
            },
            {
              icon: Shield,
              step: '3',
              title: 'ยืนยัน & ปลอดภัย',
              desc: 'หมอทุกคนผ่านการตรวจสอบใบอนุญาต ชำระมัดจำหลังยืนยัน ส่วนที่เหลือชำระวันนัด',
            },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                <Icon className="w-8 h-8 text-primary-600" />
                <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                  {step}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        © 2026 VetAcu — แพลตฟอร์มค้นหาสัตวแพทย์ฝังเข็ม
      </footer>
    </main>
  )
}
