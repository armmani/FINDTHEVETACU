export async function compressImage(
  file: File,
  { maxWidthPx = 1200, qualityJpeg = 0.75, maxSizeKB = 400 } = {}
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxWidthPx) {
        height = Math.round((height * maxWidthPx) / width)
        width = maxWidthPx
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

      const tryCompress = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return }
            if (blob.size > maxSizeKB * 1024 && quality > 0.3) {
              tryCompress(quality - 0.1)
            } else {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
            }
          },
          'image/jpeg',
          quality
        )
      }
      tryCompress(qualityJpeg)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
