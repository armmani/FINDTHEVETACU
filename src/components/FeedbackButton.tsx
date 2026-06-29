'use client'

import { useState } from 'react'
import { MessageSquarePlus, X, Send, Image as ImageIcon, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function FeedbackButton() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!message.trim()) { toast.error('กรุณาใส่ข้อความ'); return }
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }

    let image_url: string | null = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `feedback/${user.id}-${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('feedback-images').upload(path, imageFile)
      if (error) { toast.error('อัพโหลดรูปไม่สำเร็จ: ' + error.message); setSending(false); return }
      image_url = supabase.storage.from('feedback-images').getPublicUrl(data.path).data.publicUrl
    }

    const { error } = await supabase.from('feedback').insert({ user_id: user.id, message: message.trim(), image_url })
    setSending(false)
    if (error) { toast.error('ส่งไม่สำเร็จ'); return }
    toast.success('ส่ง Feedback แล้ว ขอบคุณครับ!')
    setMessage(''); setImageFile(null); setImagePreview(null); setOpen(false)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-30 bg-primary-600 hover:bg-primary-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors"
        title="แจ้ง Feedback / ขอฟีเจอร์"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">แจ้ง Feedback</h3>
                <p className="text-xs text-gray-400 mt-0.5">ทดลองใช้แล้วติดขัดตรงไหน อยากให้เพิ่มหรือลดตรงไหน บอกได้เลยครับ</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 ml-3 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="input resize-none w-full text-sm"
              rows={5}
              placeholder="เช่น อยากให้หน้า OPD แสดงประวัติย้อนหลังได้ / ปุ่มนี้ใช้งานไม่ได้ / ..."
              autoFocus
            />

            {/* Image */}
            <div className="space-y-2">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="preview" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null) }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 cursor-pointer w-fit">
                  <ImageIcon className="w-4 h-4" />
                  <span>แนบรูป (ถ้ามี)</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
                </label>
              )}
            </div>

            <button onClick={handleSubmit} disabled={sending || !message.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'กำลังส่ง...' : 'ส่ง Feedback'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
