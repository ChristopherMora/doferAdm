// Una foto de catálogo se ve a menos de 200 px en pantalla, así que no tiene
// sentido guardarla grande: viaja dentro de la fila del producto y cada byte
// se paga en cada carga. Se reduce hasta entrar en el límite en vez de
// rechazar la imagen y dejar al vendedor sin foto.
const MAX_IMAGE_BYTES = 120_000
const ATTEMPTS: Array<{ maxSide: number; quality: number }> = [
  { maxSide: 320, quality: 0.7 },
  { maxSide: 320, quality: 0.55 },
  { maxSide: 256, quality: 0.5 },
  { maxSide: 192, quality: 0.45 },
]

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

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')

    let smallest = ''
    for (const { maxSide, quality } of ATTEMPTS) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      smallest = canvas.toDataURL('image/webp', quality)
      if (smallest.length <= MAX_IMAGE_BYTES) return smallest
    }

    throw new Error('La imagen sigue siendo demasiado grande.')
  } finally {
    URL.revokeObjectURL(objectURL)
  }
}
