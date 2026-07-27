

export async function imageFileToDataURL(file: File | null): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecciona una imagen válida.')
  }

  const objectURL = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
      image.src = objectURL
    })
    const maxSide = 480
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/webp', 0.72)
    if (result.length > 900_000) {
      throw new Error('La imagen sigue siendo demasiado grande.')
    }
    return result
  } finally {
    URL.revokeObjectURL(objectURL)
  }
}
