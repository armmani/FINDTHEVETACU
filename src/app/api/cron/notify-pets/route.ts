import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r.toISOString().split('T')[0]
}

async function insertNotif(userId: string, title: string, body: string, link: string) {
  // skip if same notification already sent in last 23 hours
  const { count } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('title', title)
    .gte('created_at', new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString())
  if ((count ?? 0) > 0) return
  await supabaseAdmin.from('notifications').insert({ user_id: userId, title, body, link })
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const d1 = addDays(today, 1)
  const d7 = addDays(today, 7)
  const d30 = addDays(today, 30)

  let notified = 0

  // ---- Medical records: 1 day before next_appointment ----
  const { data: med1 } = await supabaseAdmin
    .from('pet_medical_records')
    .select('id, pet_id, title, next_appointment, pets!inner(owner_id, name)')
    .eq('next_appointment', d1)

  for (const r of med1 || []) {
    const pet = (r as any).pets
    if (!pet?.owner_id) continue
    await insertNotif(
      pet.owner_id,
      `🗓️ นัดหมาย ${pet.name} พรุ่งนี้`,
      `${r.title} — นัดหมายวันพรุ่งนี้ (${d1})`,
      `/owner/pets/${r.pet_id}`
    )
    notified++
  }

  // ---- Vaccines: 30 days before ----
  const { data: vac30 } = await supabaseAdmin
    .from('pet_vaccines')
    .select('id, pet_id, vaccine_name, next_due_date, pets!inner(owner_id, name)')
    .eq('next_due_date', d30)

  for (const v of vac30 || []) {
    const pet = (v as any).pets
    if (!pet?.owner_id) continue
    await insertNotif(
      pet.owner_id,
      `💉 วัคซีน ${pet.name} อีก 1 เดือน`,
      `${v.vaccine_name} — ครบกำหนดฉีดในอีก 30 วัน`,
      `/owner/pets/${v.pet_id}`
    )
    notified++
  }

  // ---- Vaccines: 7 days before ----
  const { data: vac7 } = await supabaseAdmin
    .from('pet_vaccines')
    .select('id, pet_id, vaccine_name, next_due_date, pets!inner(owner_id, name)')
    .eq('next_due_date', d7)

  for (const v of vac7 || []) {
    const pet = (v as any).pets
    if (!pet?.owner_id) continue
    await insertNotif(
      pet.owner_id,
      `💉 วัคซีน ${pet.name} อีก 7 วัน`,
      `${v.vaccine_name} — ครบกำหนดฉีดในอีก 7 วัน`,
      `/owner/pets/${v.pet_id}`
    )
    notified++
  }

  // ---- Parasites: 7 days before ----
  const { data: para7 } = await supabaseAdmin
    .from('pet_parasite_controls')
    .select('id, pet_id, product_name, next_due_date, pets!inner(owner_id, name)')
    .eq('next_due_date', d7)

  for (const p of para7 || []) {
    const pet = (p as any).pets
    if (!pet?.owner_id) continue
    await insertNotif(
      pet.owner_id,
      `🐛 ป้องกันปรสิต ${pet.name} อีก 7 วัน`,
      `${p.product_name} — ครบกำหนดในอีก 7 วัน`,
      `/owner/pets/${p.pet_id}`
    )
    notified++
  }

  // ---- Parasites: 1 day before ----
  const { data: para1 } = await supabaseAdmin
    .from('pet_parasite_controls')
    .select('id, pet_id, product_name, next_due_date, pets!inner(owner_id, name)')
    .eq('next_due_date', d1)

  for (const p of para1 || []) {
    const pet = (p as any).pets
    if (!pet?.owner_id) continue
    await insertNotif(
      pet.owner_id,
      `🐛 ป้องกันปรสิต ${pet.name} พรุ่งนี้`,
      `${p.product_name} — ครบกำหนดวันพรุ่งนี้`,
      `/owner/pets/${p.pet_id}`
    )
    notified++
  }

  return NextResponse.json({ ok: true, notified, checkedAt: new Date().toISOString() })
}
