import { createClient } from '@/lib/supabase'

export async function createNotification(
  userId: string,
  title: string,
  body?: string,
  link?: string
) {
  const supabase = createClient()
  await supabase.from('notifications').insert({ user_id: userId, title, body: body ?? null, link: link ?? null })
}
