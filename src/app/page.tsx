import Link from 'next/link'
import { Syringe, Clock, MapPin, Shield } from 'lucide-react'

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
            หมอฝังเข็มสัตว์ถึงบ้านคุณ
          </p>
          <p className="text-primary-200 mb-10 max-w-xl mx-auto">
            เลือกเวลาที่สะดวก รอหมอว่างตอบรับ ชำระมัดจำหลังยืนยัน — ง่าย ปลอดภัย ไม่ต้องออกจากบ้าน
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
              icon: Clock,
              step: '1',
              title: 'เลือกเวลาที่ต้องการ',
              desc: 'กรอกข้อมูลสัตว์เลี้ยง อาการ และเวลาที่ต้องการให้หมอมา',
            },
            {
              icon: Shield,
              step: '2',
              title: 'หมอตอบรับ',
              desc: 'สัตวแพทย์ที่ว่างจะเห็นคำขอและเข้ามารับงาน พร้อมราคารวมค่าเดินทาง',
            },
            {
              icon: MapPin,
              step: '3',
              title: 'ชำระมัดจำ & นัดหมาย',
              desc: 'ชำระมัดจำ 50% หลังหมอยืนยัน ส่วนที่เหลือชำระวันนัดหมาย',
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
        © 2025 VetAcu — บริการหาสัตวแพทย์ฝังเข็มออนไลน์
      </footer>
    </main>
  )
}
