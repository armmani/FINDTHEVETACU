'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Camera, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { compressImage } from '@/lib/compressImage'

interface PhotoUploadProps {
  bucket: 'avatars' | 'pet-photos'
  currentUrl?: string | null
  userId: string
  onUploaded: (url: string) => void
  size?: 'sm' | 'md' | 'lg'
  shape?: 'circle' | 'square'
  label?: string
}

export default function PhotoUpload({
  bucket, currentUrl, userId, onUploaded,
  size = 'md', shape = 'circle', label = 'อัปโหลดรูป'
}: PhotoUploadProps) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)

  const sizeClass = { sm: 'w-16 h-16', md: 'w-24 h-24', lg: 'w-32 h-32' }[size]
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl'

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('ไฟล์ใหญ่เกิน 5MB'); return }

    setUploading(true)
    const compressed = await compressImage(file, { maxWidthPx: 800, qualityJpeg: 0.75, maxSizeKB: 200 })
    const path = `${userId}/${Date.now()}.jpg`

    const { data, error } = await supabase.storage.from(bucket).upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
    if (error) { toast.error('อัปโหลดไม่สำเร็จ'); setUploading(false); return }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
    setPreview(urlData.publicUrl)
    onUploaded(urlData.publicUrl)
    toast.success('อัปโหลดรูปสำเร็จ!')
    setUploading(false)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`${sizeClass} ${shapeClass} relative overflow-hidden border-2 border-dashed border-gray-300 hover:border-primary-400 bg-gray-50 hover:bg-primary-50 transition-colors flex items-center justify-center`}
      >
        {preview ? (
          <img src={preview} alt="photo" className={`w-full h-full object-cover ${shapeClass}`} />
        ) : (
          <Camera className="w-6 h-6 text-gray-400" />
        )}
        {uploading && (
          <div className={`absolute inset-0 bg-white/70 flex items-center justify-center ${shapeClass}`}>
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        )}
        {preview && !uploading && (
          <div className={`absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center ${shapeClass}`}>
            <Camera className="w-5 h-5 text-white" />
          </div>
        )}
      </button>
      <p className="text-xs text-gray-400">{label}</p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
