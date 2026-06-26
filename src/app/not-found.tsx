import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-950">
      <Image
        src="/buffalo-404.png"
        alt="หน้าไม่พบ"
        width={260}
        height={260}
        className="mb-6 select-none"
        priority
      />
      <h1 className="text-6xl font-bold text-gray-800 dark:text-gray-100 mb-2">404</h1>
      <p className="text-xl font-medium text-gray-600 dark:text-gray-300 mb-1">ไม่พบหน้าที่คุณกำลังมองหา</p>
      <p className="text-gray-400 dark:text-gray-500 mb-8">หมอพักก่อนนะ... หน้านี้ไม่มีในระบบแล้ว</p>
      <Link
        href="/home"
        className="btn-primary px-8 py-2.5"
      >
        กลับหน้าหลัก
      </Link>
    </div>
  )
}
