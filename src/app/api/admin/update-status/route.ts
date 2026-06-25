import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await adminSupabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'super_admin'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { table, id, status, rejectReason } = body

    if (!['clinics', 'vet_profiles', 'profiles'].includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
    }

    let updates: Record<string, any> = {}
    let idField = 'id'

    if (table === 'profiles') {
      if (profile?.role !== 'super_admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      updates = { role: status }
    } else if (table === 'clinics') {
      updates = { status, reject_reason: status === 'rejected' || status === 'suspended' ? rejectReason : null }
    } else {
      idField = 'user_id'
      updates = { status, reject_reason: status === 'rejected' ? rejectReason : null, is_verified: status === 'approved' }
    }

    const { error } = await adminSupabase.from(table).update(updates).eq(idField, id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('update-status error:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
