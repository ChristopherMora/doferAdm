const MAX_REFERENCE_IMAGE_SIDE = 1280
const REFERENCE_IMAGE_QUALITY = 0.78

export async function imageFileToOptimizedDataURL(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen')
  }

  const image = await loadImage(file)
  const scale = Math.min(1, MAX_REFERENCE_IMAGE_SIDE / image.width, MAX_REFERENCE_IMAGE_SIDE / image.height)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    return readFileAsDataURL(file)
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  image.close?.()

  const blob = await canvasToBlob(canvas)
  if (!blob) {
    return readFileAsDataURL(file)
  }

  if (blob.size >= file.size && file.size <= 700_000) {
    return readFileAsDataURL(file)
  }

  return blobToDataURL(blob)
}

async function loadImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return createBitmapFromImageElement(file)
  }
}

function createBitmapFromImageElement(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      createImageBitmap(image)
        .then(resolve)
        .catch(reject)
        .finally(() => URL.revokeObjectURL(url))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', REFERENCE_IMAGE_QUALITY)
  })
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
