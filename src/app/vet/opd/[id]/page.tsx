'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, ClipboardList, CalendarDays, Scale } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import LoadingScreen from '@/components/LoadingScreen'

const EMOJI: Record<string, string> = { สุนัข: '🐕', แมว: '🐈', กระต่าย: '🐇', นก: '🐦', ปลา: '🐟', อื่นๆ: '🐾' }
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

const OPD_FIELDS = [
  { key: 'cc',      label: 'CC',      title: 'Chief Complaint' },
  { key: 'hx',      label: 'Hx',      title: 'History Taking' },
  { key: 'pe',      label: 'PE',      title: 'Physical Examination' },
  { key: 'diff_dx', label: 'Diff Dx', title: 'Differential Diagnosis' },
  { key: 'dx',      label: 'Dx',      title: 'Tentative Diagnosis' },
  { key: 'tx',      label: 'Tx',      title: 'Treatment' },
  { key: 'rx',      label: 'Rx',      title: 'Prescription' },
  { key: 'ce',      label: 'CE',      title: 'Client Education' },
] as const

function MedicalTags({ tags }: { tags: string[] }) {
  if (!tags?.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.map(t => (
        <span key={t} className="text-xs bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded-full font-medium">⚠️ {t}</span>
      ))}
    </div>
  )
}

interface OPDRecord {
  id: string
  record_date: string
  weight: number | null
  next_appointment: string | null
  photo1_url: string | null
  photo1_caption: string | null
  photo2_url: string | null
  photo2_caption: string | null
  cc: string | null; hx: string | null; pe: string | null
  diff_dx: string | null; dx: string | null
  tx: string | null; rx: string | null; ce: string | null
  pets: { name: string; species: string; breed: string | null; medical_tags: string[]; profiles: { full_name: string } | null } | null
  clinics: { name: string } | null
}

export default function OPDDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [record, setRecord] = useState<OPDRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('opd_records')
      .select('*, pets(name, species, breed, medical_tags, profiles!owner_id(full_name)), clinics(name)')
      .eq('id', id)
      .single()
      .then(({ data }) => { setRecord(data as any); setLoading(false) })
  }, [id])

  if (loading) return <LoadingScreen />
  if (!record) return (
    <div className="text-center py-20">
      <p className="text-gray-400">ไม่พบบันทึก OPD นี้</p>
      <Link href="/vet/opd" className="btn-secondary mt-4 inline-flex">← กลับ</Link>
    </div>
  )

  const pet = record.pets
  const ownerName = (pet?.profiles as any)?.full_name ?? null

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/vet/opd" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-600" /> บันทึก OPD
          </h1>
          <p className="text-sm text-gray-500">{fmtDate(record.record_date)}</p>
        </div>
      </div>

      {/* Pet + clinic summary */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{EMOJI[pet?.species || ''] || '🐾'}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg">{pet?.name}</p>
            <p className="text-sm text-gray-500">
              {pet?.species}{pet?.breed ? ` · ${pet.breed}` : ''}
            </p>
            {ownerName
              ? <p className="text-xs text-gray-400 mt-0.5">เจ้าของ: {ownerName}</p>
              : <p className="text-xs text-amber-500 mt-0.5">ยังไม่มีเจ้าของในระบบ</p>
            }
            <MedicalTags tags={pet?.medical_tags || []} />
          </div>
          {record.clinics && (
            <p className="text-sm text-gray-500 text-right shrink-0">{record.clinics.name}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-100 dark:border-gray-800">
          {record.weight != null && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-primary-700 dark:text-primary-300">
              <Scale className="w-4 h-4" /> {record.weight} kg
            </div>
          )}
          {record.next_appointment && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <CalendarDays className="w-4 h-4" />
              นัดหมายถัดไป: {fmtDate(record.next_appointment)}
            </div>
          )}
        </div>
      </div>

      {/* OPD fields */}
      <div className="space-y-3">
        {OPD_FIELDS.map(({ key, label, title }) => {
          const value = record[key as keyof OPDRecord]
          if (!value) return null
          return (
            <div key={key} className="card">
              <p className="text-xs mb-1.5">
                <span className="font-bold text-primary-600 dark:text-primary-400">{label}</span>
                <span className="text-gray-400"> — {title}</span>
              </p>
              <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                {value as string}
              </p>
            </div>
          )
        })}
      </div>

      {/* Photos */}
      {(record.photo1_url || record.photo2_url) && (
        <div>
          <p className="label mb-2">รูปภาพ</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { url: record.photo1_url, caption: record.photo1_caption },
              { url: record.photo2_url, caption: record.photo2_caption },
            ].filter(p => p.url).map((p, i) => (
              <div key={i} className="space-y-1.5">
                <a href={p.url!} target="_blank" rel="noopener noreferrer"
                  className="block relative h-44 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <Image src={p.url!} alt={p.caption || ''} fill className="object-cover hover:opacity-90 transition-opacity" />
                </a>
                {p.caption && <p className="text-xs text-gray-500 text-center">{p.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
