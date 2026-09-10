import { createClient } from '@supabase/supabase-js'

/**
 * บันทึก audit log ด้วย service role — เรียกจาก API route (server) เท่านั้น
 * best-effort: ถ้าเขียนไม่สำเร็จจะไม่ทำให้ action หลักล้ม
 */
export async function writeAudit(entry: {
  actorId: string | null
  action: string
  entity?: string
  entityId?: string
  meta?: Record<string, unknown>
}) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    await admin.from('audit_logs').insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      meta: entry.meta ?? null,
    })
  } catch (e) {
    console.error('writeAudit failed:', e)
  }
}
