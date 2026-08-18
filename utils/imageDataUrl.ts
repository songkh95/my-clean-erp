/** 이미지 파일을 축소한 data URL로 변환 (localStorage 용량 고려) */
export function fileToResizedDataUrl(
  file: File,
  maxEdge = 480,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('이미지를 처리할 수 없습니다.'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(mime, quality))
      }
      img.onerror = () => reject(new Error('이미지 형식이 올바르지 않습니다.'))
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
