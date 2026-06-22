'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Users, Stethoscope, CalendarCheck, Banknote, TrendingUp, Clock, XCircle, CheckCircle, ShieldCheck, ShieldX } from 'lucide-react'

interface Stats {
  totalOwners: number
  totalVets: number
  totalBookings: number
  pendingBookings: number
  confirmedBookings: number
  completedBookings: number
  cancelledBookings: number
  totalRevenue: number
  totalPlatformFee: number
  totalPayout: number
}

interface OwnerRow {
  id: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  created_at: string
  email: string | null
}

interface VetRow {
  user_id: string
  university: string | null
  graduation_year: string | null
  additional_education: string[]
  is_available: boolean
  is_verified: boolean
  license_number: string | null
  full_name: string
  avatar_url: string | null
}

interface BookingRow {
  id: string
  status: string
  total_fee: number
  deposit_amount: number
  platform_fee: number
  vet_payout: number | null
  deposit_paid: boolean
  cancelled_by: string | null
  created_at: string
  appointments: {
    pet_name: string
    preferred_datetime: string
    profiles: { full_name: string }
  }
  vet_profile: { full_name: string } | null
}

export default function AdminDashboard() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [vets, setVets] = useState<VetRow[]>([])
  const [owners, setOwners] = useState<OwnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [verifying, setVerifying] = useState<string | null>(null)

  const handleVerify = async (vetId: string, currentVal: boolean) => {
    setVerifying(vetId)
    await supabase.from('vet_profiles').update({ is_verified: !currentVal }).eq('user_id', vetId)
    setVets(prev => prev.map(v => v.user_id === vetId ? { ...v, is_verified: !currentVal } : v))
    setVerifying(null)
  }

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [
      { count: ownerCount, data: ownerData },
      { count: vetCount },
      { data: allBookings },
      { data: vetData },
    ] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, avatar_url, created_at', { count: 'exact' }).eq('role', 'owner').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vet'),
      supabase.from('bookings').select(`
        *,
        appointments(pet_name, preferred_datetime, profiles:owner_id(full_name)),
        vet_profile:profiles!bookings_vet_id_fkey(full_name)
      `).order('created_at', { ascending: false }),
      supabase.from('vet_profiles').select(`
        user_id, university, graduation_year, additional_education, is_available, is_verified, license_number,
        profiles!inner(full_name, avatar_url)
      `).order('is_verified', { ascending: true }),
    ])

    const mappedVets = (vetData || []).map((v: any) => ({
      ...v,
      full_name: v.profiles?.full_name || '',
      avatar_url: v.profiles?.avatar_url || null,
      is_verified: v.is_verified || false,
    }))
    setVets(mappedVets)

    const bk = allBookings || []

    const completed = bk.filter(b => b.status === 'completed')
    const totalRevenue = completed.reduce((s, b) => s + b.total_fee, 0)
    const totalPlatformFee = bk.reduce((s, b) => s + (b.platform_fee || 0), 0)
    const totalPayout = completed.reduce((s, b) => s + (b.vet_payout || 0), 0)

    setOwners((ownerData || []) as OwnerRow[])

    setStats({
      totalOwners: ownerCount || 0,
      totalVets: vetCount || 0,
      totalBookings: bk.length,
      pendingBookings: bk.filter(b => b.status === 'pending_payment').length,
      confirmedBookings: bk.filter(b => b.status === 'confirmed' || b.status === 'awaiting_confirmation').length,
      completedBookings: completed.length,
      cancelledBookings: bk.filter(b => b.status === 'cancelled').length,
      totalRevenue,
      totalPlatformFee,
      totalPayout,
    })

    setBookings(bk as BookingRow[])
    setLoading(false)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending_payment: { label: 'รอชำระมัดจำ', color: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: 'ยืนยันแล้ว', color: 'bg-green-100 text-green-700' },
    awaiting_confirmation: { label: 'รอเจ้าของยืนยัน', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'เสร็จสมบูรณ์', color: 'bg-primary-100 text-primary-700' },
    cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700' },
  }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  if (loading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* User stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.totalOwners}</p>
          <p className="text-sm text-gray-500">เจ้าของสัตว์</p>
        </div>
        <div className="card text-center">
          <Stethoscope className="w-8 h-8 text-primary-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.totalVets}</p>
          <p className="text-sm text-gray-500">สัตวแพทย์</p>
        </div>
        <div className="card text-center">
          <CalendarCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.completedBookings}</p>
          <p className="text-sm text-gray-500">รักษาสำเร็จ</p>
        </div>
        <div className="card text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.cancelledBookings}</p>
          <p className="text-sm text-gray-500">ยกเลิก</p>
        </div>
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-primary-50 border border-primary-100">
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <p className="text-sm text-primary-600 font-medium">รายได้รวม (Completed)</p>
          </div>
          <p className="text-2xl font-bold text-primary-700">{stats?.totalRevenue.toLocaleString()} บาท</p>
        </div>
        <div className="card bg-green-50 border border-green-100">
          <div className="flex items-center gap-3 mb-1">
            <Banknote className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-600 font-medium">Platform Fee รวม</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{stats?.totalPlatformFee.toLocaleString()} บาท</p>
        </div>
        <div className="card bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-3 mb-1">
            <CheckCircle className="w-5 h-5 text-gray-500" />
            <p className="text-sm text-gray-500 font-medium">จ่ายให้หมอรวม</p>
          </div>
          <p className="text-2xl font-bold text-gray-700">{stats?.totalPayout.toLocaleString()} บาท</p>
        </div>
      </div>

      {/* Booking status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'all', label: 'ทั้งหมด', count: stats?.totalBookings, color: 'gray' },
          { key: 'pending_payment', label: 'รอมัดจำ', count: stats?.pendingBookings, color: 'yellow' },
          { key: 'confirmed', label: 'กำลังดำเนินการ', count: stats?.confirmedBookings, color: 'green' },
          { key: 'cancelled', label: 'ยกเลิก', count: stats?.cancelledBookings, color: 'red' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`card text-left transition-all ${filter === s.key ? 'ring-2 ring-primary-400' : ''}`}
          >
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Vet profiles */}
      {vets.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4">รายชื่อสัตวแพทย์</h2>
          <div className="space-y-3">
            {vets.map(vet => (
              <div key={vet.user_id} className="card">
                <div className="flex gap-4 items-start justify-between">
                  <div className="flex gap-4 items-start flex-1 min-w-0">
                  {vet.avatar_url ? (
                    <img src={vet.avatar_url} alt={vet.full_name}
                      className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold shrink-0 text-sm">
                      {vet.full_name[0] || 'H'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{vet.full_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${vet.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {vet.is_available ? 'รับงาน' : 'ปิดรับ'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${vet.is_verified ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {vet.is_verified ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
                        {vet.is_verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                      </span>
                      {vet.license_number && (
                        <span className="text-xs text-gray-400">ใบอนุญาต: {vet.license_number}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleVerify(vet.user_id, vet.is_verified)}
                    disabled={verifying === vet.user_id}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors shrink-0 ${
                      vet.is_verified
                        ? 'border-red-200 text-red-500 hover:bg-red-50'
                        : 'border-blue-300 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {verifying === vet.user_id ? '...' : vet.is_verified ? 'ยกเลิก' : '✓ ยืนยัน'}
                  </button>
                    {(vet.university || vet.graduation_year) && (
                      <p className="text-sm text-gray-600 mt-0.5">
                        {vet.university || ''}
                        {vet.university && vet.graduation_year ? ' · ' : ''}
                        {vet.graduation_year ? `รุ่น ${vet.graduation_year}` : ''}
                      </p>
                    )}
                    {vet.additional_education?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {vet.additional_education.map((k: string) => (
                          <span key={k} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                            {k === 'internship' ? 'Internship' : k === 'certificate' ? 'Certificate' : k === 'resident' ? 'Resident' : k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner list */}
      {owners.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4">รายชื่อเจ้าของสัตว์ ({owners.length})</h2>
          <div className="space-y-2">
            {owners.map((o, i) => (
              <div key={o.id} className="card flex items-center gap-4 py-3">
                <span className="text-sm text-gray-300 w-6 text-right shrink-0">{i + 1}</span>
                {o.avatar_url ? (
                  <img src={o.avatar_url} alt={o.full_name}
                    className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 text-sm">
                    {o.full_name?.[0] || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800">{o.full_name || '-'}</p>
                  {o.phone && <p className="text-sm text-gray-500">📞 {o.phone}</p>}
                </div>
                <p className="text-xs text-gray-400 shrink-0">
                  {new Date(o.created_at).toLocaleDateString('th-TH', { dateStyle: 'short' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookings table */}
      <div>
        <h2 className="text-lg font-bold mb-4">รายการ Booking {filter !== 'all' && `(${statusLabel[filter]?.label})`}</h2>
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">ไม่มีรายการ</div>
          ) : filtered.map(b => {
            const apt = b.appointments as any
            return (
              <div key={b.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-sm space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{apt?.pet_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabel[b.status]?.color}`}>
                        {statusLabel[b.status]?.label}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      เจ้าของ: {apt?.profiles?.full_name} · หมอ: {(b.vet_profile as any)?.full_name || '-'}
                    </div>
                    <div className="text-gray-400 text-xs">
                      นัด: {apt?.preferred_datetime ? formatDate(apt.preferred_datetime) : '-'} · สร้าง: {formatDate(b.created_at)}
                    </div>
                  </div>
                  <div className="text-right text-sm space-y-0.5">
                    <div className="font-semibold">{b.total_fee.toLocaleString()} บาท</div>
                    <div className="text-xs text-gray-400">
                      {b.deposit_paid ? `มัดจำ ${b.deposit_amount.toLocaleString()} บาท ✓` : 'ยังไม่ชำระมัดจำ'}
                    </div>
                    {b.platform_fee > 0 && (
                      <div className="text-xs text-green-600">Platform Fee: {b.platform_fee.toLocaleString()} บาท</div>
                    )}
                    {b.cancelled_by && (
                      <div className="text-xs text-red-400">ยกเลิกโดย{b.cancelled_by === 'owner' ? 'เจ้าของ' : 'หมอ'}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
