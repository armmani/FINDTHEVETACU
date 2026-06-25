import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  // ตรวจสอบว่าเป็น admin จริง
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { table, id, status, rejectReason } = await request.json()

  if (!['clinics', 'vet_profiles'].includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  const idField = table === 'clinics' ? 'id' : 'user_id'
  const updates: Record<string, any> = { status }

  if (table === 'clinics') {
    updates.reject_reason = status === 'rejected' ? rejectReason : null
  } else {
    updates.reject_reason = status === 'rejected' ? rejectReason : null
    updates.is_verified = status === 'approved'
  }

  const { error } = await adminSupabase.from(table).update(updates).eq(idField, id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
