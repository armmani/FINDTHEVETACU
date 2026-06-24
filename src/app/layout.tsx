import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import ThemeProvider from '@/components/ThemeProvider'
import { LanguageProvider } from '@/contexts/LanguageContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TH AcuPETure — หมอฝังเข็มสัตว์ถึงบ้าน',
  description: 'หาสัตวแพทย์ฝังเข็มที่พร้อมให้บริการ ง่าย รวดเร็ว ถึงบ้าน',
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
