/**
 * Advanced Print Time Calculator
 * Calcula tiempo de impresión considerando múltiples factores
 */

import { STLMetrics } from './stlParser'

export interface PrintSettings {
  layerHeight: number // mm
  printSpeed: number // mm/s
  travelSpeed: number // mm/s
  infillPercentage: number // 0-100
  wallThickness: number // mm (número de perímetros * ancho de extrusión)
  topBottomLayers: number // número de capas sólidas arriba/abajo
  supportEnabled: boolean
  supportDensity: number // 0-100
}

export interface PrintTimeEstimate {
  totalHours: number
  breakdown: {
    wallsHours: number
    infillHours: number
    topBottomHours: number
    supportHours: number
    travelHours: number
  }
  material: {
    filamentLength: number // metros
    filamentWeight: number // gramos
    cost: number // costo del material
  }
}

const DEFAULT_SETTINGS: PrintSettings = {
  layerHeight: 0.2,
  printSpeed: 50,
  travelSpeed: 150,
  infillPercentage: 20,
  wallThickness: 1.2, // típicamente 3 perímetros de 0.4mm
  topBottomLayers: 4,
  supportEnabled: false,
  supportDensity: 15
}

/**
 * Calcula el tiempo de impresión avanzado basado en STL y configuraciones
 */
export function calculateAdvancedPrintTime(
  metrics: STLMetrics,
  settings: Partial<PrintSettings> = {}
): PrintTimeEstimate {
  const s = { ...DEFAULT_SETTINGS, ...settings }
  
  // Calcular número de capas
  const height = metrics.dimensions.depth
  const totalLayers = Math.ceil(height / s.layerHeight)
  
  // Calcular área de la base (promedio entre diferentes alturas)
  const baseArea = metrics.dimensions.width * metrics.dimensions.height
  
  // 1. PERÍMETROS/PAREDES
  const perimeter = 2 * (metrics.dimensions.width + metrics.dimensions.height)
  const wallLengthPerLayer = perimeter * (s.wallThickness / 0.4) // asumiendo nozzle 0.4mm
  const totalWallLength = wallLengthPerLayer * totalLayers // mm
  const wallTimeSeconds = totalWallLength / s.printSpeed
  const wallTimeHours = wallTimeSeconds / 3600
  
  // 2. RELLENO (INFILL)
  const infillArea = baseArea * (s.infillPercentage / 100)
  const infillLengthPerLayer = estimateInfillLength(infillArea, s.infillPercentage)
  const totalInfillLength = infillLengthPerLayer * (totalLayers - (s.topBottomLayers * 2))
  const infillTimeSeconds = totalInfillLength / s.printSpeed
  const infillTimeHours = infillTimeSeconds / 3600
  
  // 3. CAPAS SUPERIORES E INFERIORES (SÓLIDAS)
  const solidArea = baseArea * s.topBottomLayers * 2 // top + bottom
  const solidLength = solidArea / 0.4 // líneas paralelas con espacio de 0.4mm
  const solidTimeSeconds = solidLength / s.printSpeed
  const solidTimeHours = solidTimeSeconds / 3600
  
  // 4. SOPORTES
  let supportTimeHours = 0
  if (s.supportEnabled && metrics.supportAnalysis?.needsSupport) {
    const supportVolume = metrics.supportAnalysis.supportVolume || 0
    const supportLayers = totalLayers * 0.6 // estimado 60% de las capas
    const supportArea = (supportVolume / height) * (s.supportDensity / 100)
    const supportLength = supportArea * supportLayers / 0.4
    const supportTimeSeconds = supportLength / (s.printSpeed * 0.8) // más lento
    supportTimeHours = supportTimeSeconds / 3600
  }
  
  // 5. MOVIMIENTOS DE VIAJE (TRAVEL)
  // Estimado: 10-15% del tiempo total de impresión
  const printingTimeHours = wallTimeHours + infillTimeHours + solidTimeHours + supportTimeHours
  const travelTimeHours = printingTimeHours * 0.12 // 12% estimado
  
  // TIEMPO TOTAL
  const totalHours = printingTimeHours + travelTimeHours
  
  // CÁLCULO DE MATERIAL
  const totalExtrusionLength = totalWallLength + totalInfillLength + solidLength
  const filamentDiameter = 1.75 // mm (estándar)
  const filamentArea = Math.PI * Math.pow(filamentDiameter / 2, 2)
  const extrusionWidth = 0.4 // mm
  const extrusionHeight = s.layerHeight
  const extrusionArea = extrusionWidth * extrusionHeight
  
  // Longitud de filamento en metros
  const filamentLength = (totalExtrusionLength * extrusionArea) / filamentArea / 1000
  
  // Peso del filamento
  const filamentWeight = metrics.weight + (metrics.supportAnalysis?.supportWeight || 0)
  
  return {
    totalHours,
    breakdown: {
      wallsHours: wallTimeHours,
      infillHours: infillTimeHours,
      topBottomHours: solidTimeHours,
      supportHours: supportTimeHours,
      travelHours: travelTimeHours
    },
    material: {
      filamentLength: Math.round(filamentLength * 100) / 100,
      filamentWeight: Math.round(filamentWeight * 100) / 100,
      cost: 0 // Se calculará con precios de material
    }
  }
}

/**
 * Estima la longitud del patrón de relleno basado en el área y densidad
 */
function estimateInfillLength(area: number, density: number): number {
  // Patrón típico: líneas rectilineares o gyroid
  // La longitud depende del espacio entre líneas
  const lineSpacing = 0.4 / (density / 100) // mm entre líneas
  const linesCount = Math.sqrt(area) / lineSpacing
  const averageLineLength = Math.sqrt(area)
  return linesCount * averageLineLength
}

/**
 * Calcula el costo del material basado en precio por kg
 */
export function calculateMaterialCost(
  weight: number, // gramos
  pricePerKg: number // precio por kilogramo
): number {
  return (weight / 1000) * pricePerKg
}

/**
 * Presets de configuración para diferentes calidades
 */
export const QUALITY_PRESETS: Record<string, Partial<PrintSettings>> = {
  'draft': {
    layerHeight: 0.3,
    printSpeed: 80,
    infillPercentage: 10,
    topBottomLayers: 3
  },
  'normal': {
    layerHeight: 0.2,
    printSpeed: 50,
    infillPercentage: 20,
    topBottomLayers: 4
  },
  'high': {
    layerHeight: 0.15,
    printSpeed: 40,
    infillPercentage: 25,
    topBottomLayers: 5
  },
  'ultra': {
    layerHeight: 0.1,
    printSpeed: 30,
    infillPercentage: 30,
    topBottomLayers: 6
  }
}

/**
 * Formatea el tiempo de horas a string legible
 */
export function formatPrintTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  
  if (h === 0) return `${m}min`
  return `${h}h ${m}min`
}
