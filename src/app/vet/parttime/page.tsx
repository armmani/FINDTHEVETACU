'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { Briefcase, Zap, MapPin, Search, Phone, ShieldCheck, Clock, Settings } from 'lucide-react'
import LoadingScreen from '@/components/LoadingScreen'
import ChatButton from '@/components/ChatButton'
import { JOB_TYPES, JOB_TYPE_LABEL, type PartTimeRow } from '@/lib/partTime'

interface Listing extends PartTimeRow {
  full_name: string
  avatar_url: string | null
  phone: string | null
  show_phone: boolean
  allow_chat: boolean
  title: string | null
  license_number: string | null
}

const since = (iso: string | null) => {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'อัปเดตวันนี้'
  if (days === 1) return 'อัปเดตเมื่อวาน'
  if (days < 30) return `อัปเดต ${days} วันที่แล้ว`
  return `อัปเดต ${Math.floor(days / 30)} เดือนที่แล้ว`
}

export default function PartTimeBoardPage() {
  const supabase = createClient()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState('')
  const [search, setSearch] = useState('')
  const [provinceFilter, setProvinceFilter] = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [urgentOnly, setUrgentOnly] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setMe(user.id)

      const { data: rows } = await supabase
        .from('vet_part_time')
        .select('*')
        .eq('is_open', true)
        .order('updated_at', { ascending: false })

      const list = (rows || []) as PartTimeRow[]
      if (list.length === 0) { setListings([]); setLoading(false); return }

      const ids = list.map(r => r.vet_id)
      const [{ data: people }, { data: vps }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url, phone').in('id', ids),
        supabase.from('vet_profiles').select('user_id, title, license_number, show_phone, allow_chat').in('user_id', ids),
      ])

      const peopleMap = new Map((people || []).map((p: any) => [p.id, p]))
      const vpMap = new Map((vps || []).map((v: any) => [v.user_id, v]))

      setListings(list.map(r => {
        const p: any = peopleMap.get(r.vet_id)
        const vp: any = vpMap.get(r.vet_id)
        return {
          ...r,
          full_name: p?.full_name || 'สัตวแพทย์',
          avatar_url: p?.avatar_url ?? null,
          phone: p?.phone ?? null,
          show_phone: vp?.show_phone ?? true,
          allow_chat: vp?.allow_chat ?? true,
          title: vp?.title ?? null,
          license_number: vp?.license_number ?? null,
        }
      }))
      setLoading(false)
    }
    load()
  }, [])

  const allProvinces = Array.from(new Set(listings.flatMap(l => l.provinces))).sort()

  const filtered = listings.filter(l => {
    const s = search.toLowerCase().trim()
    const matchSearch = !s ||
      l.full_name.toLowerCase().includes(s) ||
      (l.note || '').toLowerCase().includes(s) ||
      l.provinces.some(p => p.toLowerCase().includes(s)) ||
      l.job_types.some(j => (JOB_TYPE_LABEL[j] || '').toLowerCase().includes(s))
    const matchProvince = !provinceFilter || l.provinces.includes(provinceFilter)
    const matchJob = !jobFilter || l.job_types.includes(jobFilter)
    const matchUrgent = !urgentOnly || l.urgent_ok
    return matchSearch && matchProvince && matchJob && matchUrgent
  })

  if (loading) return <LoadingScreen />

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary-600" /> หมอรับงานพาร์ทไทม์
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">หน้านี้เห็นเฉพาะสัตวแพทย์ด้วยกัน</p>
        </div>
        <Link href="/vet/profile#parttime"
          className="btn-secondary text-xs flex items-center gap-1.5 shrink-0 py-2">
          <Settings className="w-3.5 h-3.5" /> ตั้งค่าของฉัน
        </Link>
      </div>

      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9" placeholder="ค้นหาชื่อหมอ, ประเภทงาน, จังหวัด..." />
        </div>
        <div className="flex gap-2">
          <select value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)} className="input flex-1">
            <option value="">ทุกจังหวัด</option>
            {allProvinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={jobFilter} onChange={e => setJobFilter(e.target.value)} className="input flex-1">
            <option value="">ทุกประเภทงาน</option>
            {JOB_TYPES.map(j => <option key={j.key} value={j.key}>{j.label}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => setUrgentOnly(v => !v)}
          className={`w-full flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg border-2 transition-colors ${
            urgentOnly
              ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-amber-300'
          }`}>
          <Zap className="w-4 h-4" /> เฉพาะคนที่รับงานด่วน
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{listings.length === 0 ? 'ยังไม่มีหมอเปิดรับงานพาร์ทไทม์' : 'ไม่พบหมอที่ตรงกับเงื่อนไข'}</p>
          {listings.length === 0 && (
            <Link href="/vet/profile#parttime" className="text-primary-500 text-sm mt-2 inline-block hover:underline">
              เปิดสถานะรับงานของคุณเป็นคนแรก
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => (
            <div key={l.vet_id} className="card space-y-3">
              <div className="flex gap-3 items-start">
                <Link href={`/vets/${l.vet_id}`} className="shrink-0">
                  {l.avatar_url ? (
                    <Image src={l.avatar_url} alt={l.full_name} width={48} height={48}
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-100" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                      {l.full_name[0] || 'H'}
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/vets/${l.vet_id}`} className="font-semibold hover:underline">
                      {l.title ? `${l.title}${l.full_name}` : l.full_name}
                    </Link>
                    {l.urgent_ok && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Zap className="w-3 h-3" /> รับงานด่วน
                      </span>
                    )}
                  </div>
                  {l.license_number && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-xs text-gray-500">ใบอนุญาต: {l.license_number}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {since(l.updated_at)}
                  </p>
                </div>
              </div>

              {l.provinces.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {l.provinces.map(p => (
                    <span key={p} className="text-xs bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-300 px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                </div>
              )}

              {l.job_types.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {l.job_types.map(j => (
                    <span key={j} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 px-2 py-0.5 rounded-full">
                      {JOB_TYPE_LABEL[j] || j}
                    </span>
                  ))}
                </div>
              )}

              {l.note && <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{l.note}</p>}
              {l.rate_note && (
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-600 dark:text-gray-300">ค่าตอบแทน:</span> {l.rate_note}
                </p>
              )}

              {l.vet_id !== me && (
                <div className="flex gap-2 pt-1">
                  {l.allow_chat && <ChatButton targetUserId={l.vet_id} className="flex-1 text-sm py-2" />}
                  {l.show_phone && l.phone && (
                    <a href={`tel:${l.phone}`}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm py-2">
                      <Phone className="w-4 h-4" /> {l.phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
