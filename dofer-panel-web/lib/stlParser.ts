/**
 * STL Parser - Analiza archivos STL (ASCII y Binary)
 * Calcula volumen, peso y dimensiones del modelo 3D
 */

export interface STLMetrics {
  vertices: number
  triangles: number
  volume: number // mm³
  weight: number // gramos (asumiendo densidad de material)
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
    minZ: number
    maxZ: number
  }
  dimensions: {
    width: number
    height: number
    depth: number
  }
  supportAnalysis?: {
    needsSupport: boolean
    overhangTriangles: number
    supportVolume: number // mm³ estimado de soportes
    supportWeight: number // gramos estimado
  }
}

interface Vector3 {
  x: number
  y: number
  z: number
}

// Densidades de materiales comunes (g/cm³)
export const MATERIAL_DENSITIES: Record<string, number> = {
  'PLA': 1.24,
  'ABS': 1.04,
  'PETG': 1.27,
  'TPU': 1.21,
  'NYLON': 1.14,
  'Resin': 1.18,
}

/**
 * Calcula el volumen de un tetraedro formado por el triángulo y el origen
 * Usamos la fórmula de divergencia para calcular volumen total
 */
function tetrahedral_volume(v1: Vector3, v2: Vector3, v3: Vector3): number {
  return (
    v1.x * (v2.y * v3.z - v3.y * v2.z) -
    v1.y * (v2.x * v3.z - v3.x * v2.z) +
    v1.z * (v2.x * v3.y - v3.x * v2.y)
  ) / 6.0
}

/**
 * Parsea un archivo STL ASCII
 */
function parseASCIISTL(text: string): Vector3[][] {
  const triangles: Vector3[][] = []
  const vertexPattern =
    /vertex\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/g

  let match
  let currentTriangle: Vector3[] = []

  while ((match = vertexPattern.exec(text)) !== null) {
    const vertex: Vector3 = {
      x: parseFloat(match[1]),
      y: parseFloat(match[3]),
      z: parseFloat(match[5]),
    }
    currentTriangle.push(vertex)

    if (currentTriangle.length === 3) {
      triangles.push(currentTriangle)
      currentTriangle = []
    }
  }

  return triangles
}

/**
 * Parsea un archivo STL Binary
 */
function parseBinarySTL(buffer: ArrayBuffer): Vector3[][] {
  const view = new DataView(buffer)
  const triangles: Vector3[][] = []

  // Skip header (80 bytes)
  const triangleCount = view.getUint32(80, true)

  let offset = 84
  for (let i = 0; i < triangleCount; i++) {
    const triangle: Vector3[] = []

    // Skip normal vector (3 floats, 12 bytes)
    offset += 12

    // Read 3 vertices (3 floats each)
    for (let j = 0; j < 3; j++) {
      const x = view.getFloat32(offset, true)
      const y = view.getFloat32(offset + 4, true)
      const z = view.getFloat32(offset + 8, true)
      triangle.push({ x, y, z })
      offset += 12
    }

    // Skip attribute byte count (2 bytes)
    offset += 2

    triangles.push(triangle)
  }

  return triangles
}

/**
 * Parsea un archivo STL (detecta formato automáticamente)
 */
export async function parseSTL(file: File): Promise<STLMetrics> {
  const buffer = await file.arrayBuffer()
  const view = new Uint8Array(buffer)

  // Detectar si es ASCII o Binary
  // ASCII comienza con "solid"
  const isASCII = buffer.byteLength > 5 && 
    view[0] === 115 && // 's'
    view[1] === 111 && // 'o'
    view[2] === 108 && // 'l'
    view[3] === 105 && // 'i'
    view[4] === 100    // 'd'

  let triangles: Vector3[][]

  if (isASCII) {
    const text = new TextDecoder().decode(buffer)
    triangles = parseASCIISTL(text)
  } else {
    triangles = parseBinarySTL(buffer)
  }

  // Calcular métricas
  const metrics = calculateMetrics(triangles)
  return metrics
}

/**
 * Calcula métricas del modelo STL
 */
function calculateMetrics(triangles: Vector3[][]): STLMetrics {
  let volume = 0
  let minX = Infinity,
    maxX = -Infinity
  let minY = Infinity,
    maxY = -Infinity
  let minZ = Infinity,
    maxZ = -Infinity

  triangles.forEach((triangle) => {
    // Sumar volumen usando signed volume de tetraedro
    volume += tetrahedral_volume(triangle[0], triangle[1], triangle[2])

    // Actualizar bounds
    triangle.forEach((vertex) => {
      minX = Math.min(minX, vertex.x)
      maxX = Math.max(maxX, vertex.x)
      minY = Math.min(minY, vertex.y)
      maxY = Math.max(maxY, vertex.y)
      minZ = Math.min(minZ, vertex.z)
      maxZ = Math.max(maxZ, vertex.z)
    })
  })

  // El volumen debe ser positivo (en valor absoluto)
  volume = Math.abs(volume)

  // Convertir de mm³ a cm³ (dividir por 1000)
  const volumeCm3 = volume / 1000

  // Calcular peso asumiendo densidad de PLA (predeterminado)
  const weight = volumeCm3 * MATERIAL_DENSITIES['PLA']

  // Análisis de soportes
  const supportAnalysis = analyzeSupportNeeds(triangles)

  return {
    vertices: triangles.length * 3,
    triangles: triangles.length,
    volume: volume,
    weight: weight,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
    },
    dimensions: {
      width: maxX - minX,
      height: maxY - minY,
      depth: maxZ - minZ,
    },
    supportAnalysis
  }
}

/**
 * Analiza si el modelo necesita soportes
 */
function analyzeSupportNeeds(triangles: Vector3[][]): {
  needsSupport: boolean
  overhangTriangles: number
  supportVolume: number
  supportWeight: number
} {
  let overhangCount = 0
  let totalOverhangArea = 0
  
  // Ángulo crítico: 45 grados (0.785 radianes)
  const criticalAngle = 45 * (Math.PI / 180)
  
  triangles.forEach((triangle) => {
    // Calcular normal del triángulo
    const v1 = triangle[0]
    const v2 = triangle[1]
    const v3 = triangle[2]
    
    // Vectores de los lados
    const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z }
    const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z }
    
    // Producto cruz para obtener normal
    const normal = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x
    }
    
    // Normalizar
    const length = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2)
    if (length > 0) {
      normal.x /= length
      normal.y /= length
      normal.z /= length
    }
    
    // Ángulo con respecto a la vertical (eje Z)
    // normal.z indica qué tan vertical está la superficie
    // Si normal.z < cos(45°) entonces necesita soporte
    if (normal.z < 0 && Math.abs(normal.z) > Math.cos(criticalAngle)) {
      overhangCount++
      // Calcular área del triángulo
      const area = length / 2
      totalOverhangArea += area
    }
  })
  
  const needsSupport = overhangCount > (triangles.length * 0.05) // >5% de triángulos con overhang
  
  // Estimar volumen de soporte (muy aproximado)
  // Asumimos ~20% del área de overhang como volumen de soporte
  const supportVolume = totalOverhangArea * 0.2
  const supportWeight = (supportVolume / 1000) * MATERIAL_DENSITIES['PLA']
  
  return {
    needsSupport,
    overhangTriangles: overhangCount,
    supportVolume,
    supportWeight
  }
}

/**
 * Calcula el peso basado en volumen y densidad del material
 */
export function calculateWeight(volumeCm3: number, material: string = 'PLA'): number {
  const density = MATERIAL_DENSITIES[material] || MATERIAL_DENSITIES['PLA']
  return volumeCm3 * density
}

/**
 * Formatea las métricas para mostrar
 */
export function formatMetrics(metrics: STLMetrics): Record<string, string> {
  return {
    triangles: metrics.triangles.toLocaleString(),
    vertices: metrics.vertices.toLocaleString(),
    weight: `${metrics.weight.toFixed(2)} g`,
    volume: `${metrics.volume.toFixed(2)} mm³`,
    volumeCm3: `${(metrics.volume / 1000).toFixed(2)} cm³`,
    width: `${metrics.dimensions.width.toFixed(2)} mm`,
    height: `${metrics.dimensions.height.toFixed(2)} mm`,
    depth: `${metrics.dimensions.depth.toFixed(2)} mm`,
  }
}
