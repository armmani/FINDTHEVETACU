import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import ThemeProvider from '@/components/ThemeProvider'
import { LanguageProvider } from '@/contexts/LanguageContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FindTheVet — สัตวแพทย์ไหนดี',
  description: 'ค้นหาสัตวแพทย์และคลินิกสัตว์ใกล้คุณ ดูโปรไฟล์ ใบอนุญาต และตารางออกตรวจได้เลย',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
