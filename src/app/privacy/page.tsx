import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'นโยบายความเป็นส่วนตัว (PDPA) — FindTheVet',
  description: 'นโยบายความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคลของ FindTheVet',
}

const UPDATED = '10 กันยายน 2569'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Image src="/FindTheVet.png" alt="FindTheVet" width={130} height={36} className="h-8 w-auto" priority />
        </div>

        <div className="card space-y-5 text-sm leading-relaxed">
          <div>
            <h1 className="text-2xl font-bold">นโยบายความเป็นส่วนตัว</h1>
            <p className="text-gray-400 text-xs mt-1">อัปเดตล่าสุด {UPDATED} · ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
          </div>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">1. ข้อมูลที่เราเก็บรวบรวม</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>ข้อมูลบัญชี: ชื่อ-นามสกุล อีเมล เบอร์โทรศัพท์ ที่อยู่ รูปโปรไฟล์</li>
              <li>ข้อมูลสัตวแพทย์: เลขใบอนุญาต ประวัติการศึกษา เอกสารยืนยันตัวตน ที่ตั้ง/พิกัด ตารางออกตรวจ</li>
              <li>ข้อมูลสัตว์เลี้ยงและประวัติสุขภาพ: ชื่อ ชนิด สายพันธุ์ ประวัติการรักษา วัคซีน การป้องกันปรสิต</li>
              <li>ช่องทางติดต่อเสริม: LINE ID, Facebook, Telegram Chat ID (เมื่อคุณเลือกกรอก)</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">2. วัตถุประสงค์ในการใช้ข้อมูล</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
              <li>ให้บริการค้นหาและจับคู่ระหว่างเจ้าของสัตว์เลี้ยงและสัตวแพทย์/คลินิก</li>
              <li>ยืนยันตัวตนและใบอนุญาตของสัตวแพทย์และคลินิก</li>
              <li>บันทึกและแสดงประวัติสุขภาพสัตว์เลี้ยงให้เจ้าของและสัตวแพทย์ที่เกี่ยวข้อง</li>
              <li>ส่งการแจ้งเตือนเกี่ยวกับบริการผ่านเว็บและ Telegram</li>
              <li>ดูแลความปลอดภัยของระบบและปรับปรุงพัฒนาบริการ</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">3. การเปิดเผยข้อมูล</h2>
            <p className="text-gray-600 dark:text-gray-300">
              เราจะไม่ขายหรือเปิดเผยข้อมูลส่วนบุคคลของคุณแก่บุคคลภายนอกเพื่อการตลาด
              ข้อมูลจะถูกแสดงเฉพาะเท่าที่จำเป็นต่อการให้บริการ เช่น โปรไฟล์สาธารณะของสัตวแพทย์
              (โดยคุณเลือกได้เองว่าจะเปิดเผยช่องทางติดต่อใดบ้าง) และประวัติสุขภาพที่แชร์ระหว่างเจ้าของกับสัตวแพทย์ที่เกี่ยวข้อง
              หรือเมื่อมีหน้าที่ตามกฎหมาย
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">4. การจัดเก็บและความปลอดภัย</h2>
            <p className="text-gray-600 dark:text-gray-300">
              ข้อมูลถูกจัดเก็บบนโครงสร้างพื้นฐานที่เข้ารหัสระหว่างส่ง (HTTPS/TLS) และเข้ารหัสขณะจัดเก็บ (encryption at rest)
              รหัสผ่านถูกแฮชและไม่เก็บเป็นข้อความธรรมดา การเข้าถึงข้อมูลถูกควบคุมด้วยสิทธิ์ตามบทบาทผู้ใช้
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">5. สิทธิ์ของเจ้าของข้อมูล</h2>
            <p className="text-gray-600 dark:text-gray-300">
              คุณมีสิทธิ์เข้าถึง แก้ไข หรือขอลบข้อมูลส่วนบุคคลของคุณ รวมถึงถอนความยินยอมได้ตลอดเวลา
              โดยแก้ไขได้เองในหน้าตั้งค่า หรือขอลบบัญชี/ข้อมูลผ่านปุ่ม “ขอลบบัญชีและข้อมูล” ในหน้าตั้งค่าโปรไฟล์
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">6. ติดต่อเรา</h2>
            <p className="text-gray-600 dark:text-gray-300">
              หากมีคำถามเกี่ยวกับข้อมูลส่วนบุคคล ติดต่อผ่านปุ่ม Feedback ในระบบได้ตลอดเวลา
            </p>
          </section>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/" className="hover:underline">← กลับหน้าหลัก</Link>
        </p>
      </div>
    </div>
  )
}
