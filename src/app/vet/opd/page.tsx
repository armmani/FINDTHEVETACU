'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ClipboardList, Plus, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import LoadingScreen from '@/components/LoadingScreen'

interface OPDSummary {
  id: string
  record_date: string
  dx: string | null
  weight: number | null
  pets: { name: string; species: string }
  clinics: { name: string } | null
}

const EMOJI: Record<string, string> = { สุนัข: '🐕', แมว: '🐈', กระต่าย: '🐇', นก: '🐦', ปลา: '🐟', อื่นๆ: '🐾' }
const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

export default function OPDListPage() {
  const supabase = createClient()
  const router = useRouter()
  const [records, setRecords] = useState<OPDSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('opd_records')
        .select('id, record_date, dx, weight, pets(name, species), clinics(name)')
        .eq('vet_id', user.id)
        .order('record_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)
      setRecords((data as any) || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingScreen />

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary-600" />
          บันทึก OPD
        </h1>
        <Link href="/vet/opd/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> บันทึกใหม่
        </Link>
      </div>

      {records.length === 0 ? (
        <div className="card text-center py-14">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">ยังไม่มีบันทึก OPD</p>
          <Link href="/vet/opd/new" className="btn-primary inline-flex mt-4 gap-2 text-sm">
            <Plus className="w-4 h-4" /> บันทึก OPD แรก
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <button key={r.id} onClick={() => router.push(`/vet/opd/${r.id}`)}
              className="card w-full text-left flex items-center gap-3 hover:shadow-md transition-shadow">
              <span className="text-2xl shrink-0">{EMOJI[r.pets?.species] || '🐾'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{r.pets?.name}</p>
                  {r.clinics && <span className="text-xs text-gray-400">{r.clinics.name}</span>}
                </div>
                {r.dx && <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{r.dx}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  {fmtDate(r.record_date)}{r.weight != null ? ` · ${r.weight} kg` : ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
