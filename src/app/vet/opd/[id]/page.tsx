'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, ClipboardList, CalendarDays, Scale, Pencil, X, Check, Plus } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import LoadingScreen from '@/components/LoadingScreen'
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect'
import toast from 'react-hot-toast'

const EMOJI: Record<string, string> = { สุนัข: '🐕', แมว: '🐈', กระต่าย: '🐇', นก: '🐦', ปลา: '🐟', อื่นๆ: '🐾' }
const SPECIES = ['สุนัข', 'แมว', 'กระต่าย', 'นก', 'ปลา', 'อื่นๆ']
const GENDERS = ['เพศผู้', 'เพศเมีย', 'ไม่ระบุ']
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

interface PetInfo {
  id: string
  name: string
  species: string
  breed: string | null
  gender: string | null
  neutered: boolean
  photo_url: string | null
  medical_tags: string[]
  profiles: { full_name: string } | null
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
  pets: PetInfo | null
  clinics: { name: string } | null
}

export default function OPDDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [record, setRecord] = useState<OPDRecord | null>(null)
  const [loading, setLoading] = useState(true)

  // Pet edit state
  const [editingPet, setEditingPet] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSpecies, setEditSpecies] = useState('')
  const [editBreed, setEditBreed] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editNeutered, setEditNeutered] = useState(false)
  const [editTags, setEditTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [breedOptions, setBreedOptions] = useState<SelectOption[]>([])
  const [loadingBreeds, setLoadingBreeds] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('opd_records')
      .select('*, pets(id, name, species, breed, gender, neutered, photo_url, medical_tags, profiles!owner_id(full_name)), clinics(name)')
      .eq('id', id)
      .single()
      .then(({ data }) => { setRecord(data as any); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (!editingPet) return
    if (editSpecies === 'อื่นๆ' || editSpecies === 'ปลา') { setBreedOptions([]); return }
    setLoadingBreeds(true)
    supabase.from('pet_breeds').select('id, name, name_en').eq('species', editSpecies).order('name')
      .then(({ data }) => {
        setBreedOptions((data || []).map((b: any) => ({ value: b.name, label: b.name_en ? `${b.name} / ${b.name_en}` : b.name })))
        setLoadingBreeds(false)
      })
  }, [editSpecies, editingPet])

  const openEdit = () => {
    const pet = record?.pets
    if (!pet) return
    setEditName(pet.name)
    setEditSpecies(pet.species)
    setEditBreed(pet.breed || '')
    setEditGender(pet.gender || 'ไม่ระบุ')
    setEditNeutered(pet.neutered || false)
    setEditTags(pet.medical_tags || [])
    setEditingPet(true)
  }

  const addTag = (val: string) => {
    const t = val.trim()
    if (t && !editTags.includes(t)) setEditTags(prev => [...prev, t])
    setTagInput('')
  }

  const handleSavePet = async () => {
    if (!record?.pets?.id) return
    if (!editName.trim()) { toast.error('กรุณาใส่ชื่อสัตว์เลี้ยง'); return }
    setSaving(true)
    const { error } = await supabase.from('pets').update({
      name: editName.trim(),
      species: editSpecies,
      breed: editBreed.trim() || null,
      gender: editGender,
      neutered: editNeutered,
      medical_tags: editTags,
    }).eq('id', record.pets.id)

    if (error) { toast.error('บันทึกไม่สำเร็จ'); setSaving(false); return }

    setRecord(prev => prev ? {
      ...prev,
      pets: prev.pets ? {
        ...prev.pets,
        name: editName.trim(),
        species: editSpecies,
        breed: editBreed.trim() || null,
        gender: editGender,
        neutered: editNeutered,
        medical_tags: editTags,
      } : null
    } : null)
    toast.success('แก้ไขข้อมูลแล้ว')
    setEditingPet(false)
    setSaving(false)
  }

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
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
            {pet?.photo_url
              ? <Image src={pet.photo_url} alt={pet.name} width={56} height={56} className="w-full h-full object-cover" />
              : <span className="text-2xl">{EMOJI[pet?.species || ''] || '🐾'}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg">{pet?.name}</p>
            <p className="text-sm text-gray-500">
              {pet?.species}{pet?.breed ? ` · ${pet.breed}` : ''}
              {pet?.gender && pet.gender !== 'ไม่ระบุ' ? ` · ${pet.gender}` : ''}
              {pet?.neutered ? ' · ทำหมันแล้ว' : ''}
            </p>
            {ownerName
              ? <p className="text-xs text-gray-400 mt-0.5">เจ้าของ: {ownerName}</p>
              : <p className="text-xs text-amber-500 mt-0.5">ยังไม่มีเจ้าของในระบบ</p>
            }
            <MedicalTags tags={pet?.medical_tags || []} />
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {record.clinics && (
              <p className="text-sm text-gray-500">{record.clinics.name}</p>
            )}
            <button onClick={openEdit}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-700 rounded-lg px-2 py-1 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors">
              <Pencil className="w-3 h-3" /> แก้ไข
            </button>
          </div>
        </div>

        {record.weight != null || record.next_appointment ? (
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
        ) : null}

        {/* Inline pet edit form */}
        {editingPet && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">แก้ไขข้อมูลสัตว์เลี้ยง</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">ชื่อ *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">ชนิด</label>
                <select value={editSpecies} onChange={e => { setEditSpecies(e.target.value); setEditBreed('') }} className="input">
                  {SPECIES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">สายพันธุ์</label>
                {editSpecies === 'อื่นๆ' || editSpecies === 'ปลา' ? (
                  <input value={editBreed} onChange={e => setEditBreed(e.target.value)} className="input" placeholder="ระบุสายพันธุ์" />
                ) : (
                  <SearchableSelect value={editBreed} onChange={setEditBreed}
                    options={breedOptions} loading={loadingBreeds}
                    placeholder="ค้นหาสายพันธุ์..." freeTextPlaceholder="ระบุสายพันธุ์..."
                    notInListLabel="ไม่มีในรายการ — กรอกเอง" />
                )}
              </div>
              <div>
                <label className="label">เพศ</label>
                <select value={editGender} onChange={e => setEditGender(e.target.value)} className="input">
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">การทำหมัน</label>
              <div className="flex gap-2">
                {[{ v: false, label: 'ยังไม่ได้ทำหมัน' }, { v: true, label: 'ทำหมันแล้ว' }].map(opt => (
                  <button key={String(opt.v)} type="button" onClick={() => setEditNeutered(opt.v)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors
                      ${editNeutered === opt.v
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Medical Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editTags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded-full font-medium">
                    ⚠️ {t}
                    <button onClick={() => setEditTags(prev => prev.filter(x => x !== t))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                  className="input flex-1 text-sm" placeholder="เช่น แพ้ยา Penicillin" />
                <button type="button" onClick={() => addTag(tagInput)}
                  className="btn-secondary px-3"><Plus className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingPet(false)}
                className="flex-1 btn-secondary flex items-center justify-center gap-1">
                <X className="w-4 h-4" /> ยกเลิก
              </button>
              <button onClick={handleSavePet} disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-1">
                <Check className="w-4 h-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        )}
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
