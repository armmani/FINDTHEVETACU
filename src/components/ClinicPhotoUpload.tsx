'use client'

import { useRef, useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { Camera, X, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface ClinicPhotoUploadProps {
  currentUrl?: string | null
  onFileReady: (file: File) => void
  disabled?: boolean
}

async function getCroppedImg(imageSrc: string, croppedAreaPixels: { x: number; y: number; width: number; height: number }): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  canvas.width = croppedAreaPixels.width
  canvas.height = croppedAreaPixels.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    croppedAreaPixels.x, croppedAreaPixels.y,
    croppedAreaPixels.width, croppedAreaPixels.height,
    0, 0,
    croppedAreaPixels.width, croppedAreaPixels.height,
  )

  return new Promise((resolve) => {
    canvas.toBlob(blob => {
      resolve(new File([blob!], 'clinic-photo.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.88)
  })
}

export default function ClinicPhotoUpload({ currentUrl, onFileReady, disabled }: ClinicPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rawSrc, setRawSrc] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_: any, pixels: any) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setRawSrc(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    e.target.value = ''
  }

  const handleConfirm = async () => {
    if (!rawSrc || !croppedAreaPixels) return
    setProcessing(true)
    try {
      const file = await getCroppedImg(rawSrc, croppedAreaPixels)
      const previewUrl = URL.createObjectURL(file)
      setPreview(previewUrl)
      onFileReady(file)
      setRawSrc(null)
    } catch {
      toast.error('ครอปรูปไม่สำเร็จ')
    }
    setProcessing(false)
  }

  return (
    <>
      {/* รูปปัจจุบัน / placeholder */}
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center ${!disabled ? 'cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors' : ''}`}
      >
        {preview ? (
          <>
            <img src={preview} alt="รูปคลินิก" className="w-full h-full object-cover" />
            {!disabled && (
              <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Camera className="w-8 h-8" />
            <span className="text-sm">คลิกเพื่อเลือกรูป</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {/* Crop modal */}
      {rawSrc && (
        <div className="fixed inset-0 z-50 bg-black/80" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Cropper area — ต้องมี height จริงๆ */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <Cropper
              image={rawSrc}
              crop={crop}
              zoom={zoom}
              aspect={4 / 3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Controls */}
          <div style={{ background: 'rgba(0,0,0,0.75)', padding: '16px 24px', flexShrink: 0 }} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-white text-sm w-16 shrink-0">ซูม</span>
              <input type="range" min={1} max={3} step={0.05} value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRawSrc(null)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-700 text-white text-sm font-medium hover:bg-gray-600 transition-colors">
                <X className="w-4 h-4" /> ยกเลิก
              </button>
              <button onClick={handleConfirm} disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 transition-colors disabled:opacity-60">
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                ใช้รูปนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
