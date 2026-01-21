/**
 * Auto-Assignment System
 * Sistema de auto-asignación inteligente de órdenes
 */

export interface Printer {
  id: string
  name: string
  type: 'FDM' | 'SLA' | 'SLS'
  status: 'available' | 'busy' | 'maintenance' | 'offline'
  buildVolume: {
    width: number
    height: number
    depth: number
  }
  materials: string[] // materiales soportados
  currentJob?: {
    orderId: string
    estimatedCompletion: Date
  }
  capabilities: {
    maxLayerHeight: number
    minLayerHeight: number
    maxPrintSpeed: number
  }
}

export interface Order {
  id: string
  material: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  deadline?: Date
  dimensions: {
    width: number
    height: number
    depth: number
  }
  estimatedTime: number // horas
  created_at: Date
}

export interface AssignmentResult {
  success: boolean
  printerId?: string
  printerName?: string
  reason?: string
  estimatedStart?: Date
  estimatedCompletion?: Date
  queue Position?: number
}

/**
 * Asigna automáticamente una orden a la impresora más adecuada
 */
export async function autoAssignOrder(
  order: Order,
  printers: Printer[]
): Promise<AssignmentResult> {
  // 1. Filtrar impresoras disponibles que soporten el material
  const compatiblePrinters = printers.filter(printer => 
    printer.materials.includes(order.material) &&
    canFitInBuildVolume(order.dimensions, printer.buildVolume)
  )

  if (compatiblePrinters.length === 0) {
    return {
      success: false,
      reason: 'No hay impresoras compatibles con este material y tamaño'
    }
  }

  // 2. Calcular puntuación para cada impresora
  const scoredPrinters = compatiblePrinters.map(printer => ({
    printer,
    score: calculatePrinterScore(printer, order)
  }))

  // 3. Ordenar por puntuación (mayor a menor)
  scoredPrinters.sort((a, b) => b.score - a.score)

  // 4. Seleccionar la mejor opción
  const bestPrinter = scoredPrinters[0].printer

  // 5. Calcular tiempos estimados
  const now = new Date()
  let estimatedStart = now
  
  if (bestPrinter.currentJob) {
    estimatedStart = bestPrinter.currentJob.estimatedCompletion
  }

  const estimatedCompletion = new Date(
    estimatedStart.getTime() + (order.estimatedTime * 60 * 60 * 1000)
  )

  // 6. Verificar si cumple con el deadline
  if (order.deadline && estimatedCompletion > order.deadline) {
    // Buscar alternativa que cumpla con el deadline
    const viablePrinter = findPrinterMeetingDeadline(
      scoredPrinters.map(sp => sp.printer),
      order
    )

    if (!viablePrinter) {
      return {
        success: false,
        reason: `No se puede cumplir con el deadline (${order.deadline.toLocaleDateString()}). Completaría el ${estimatedCompletion.toLocaleDateString()}`
      }
    }

    return {
      success: true,
      printerId: viablePrinter.id,
      printerName: viablePrinter.name,
      estimatedStart,
      estimatedCompletion,
      queuePosition: viablePrinter.status === 'busy' ? 1 : 0
    }
  }

  return {
    success: true,
    printerId: bestPrinter.id,
    printerName: bestPrinter.name,
    estimatedStart,
    estimatedCompletion,
    queuePosition: bestPrinter.status === 'busy' ? 1 : 0
  }
}

/**
 * Calcula puntuación de una impresora para una orden específica
 */
function calculatePrinterScore(printer: Printer, order: Order): number {
  let score = 0

  // Factor 1: Estado de la impresora (más importante)
  if (printer.status === 'available') {
    score += 100
  } else if (printer.status === 'busy') {
    score += 50
    // Penalizar por tiempo restante del trabajo actual
    if (printer.currentJob) {
      const remainingHours = 
        (printer.currentJob.estimatedCompletion.getTime() - Date.now()) / (1000 * 60 * 60)
      score -= remainingHours * 2
    }
  } else {
    score -= 1000 // offline o maintenance
  }

  // Factor 2: Prioridad de la orden
  const priorityScores = {
    'low': 10,
    'normal': 25,
    'high': 50,
    'urgent': 100
  }
  score += priorityScores[order.priority]

  // Factor 3: Eficiencia del volumen de construcción
  // Preferir impresoras con volumen más ajustado al trabajo
  const volumeEfficiency = calculateVolumeEfficiency(
    order.dimensions,
    printer.buildVolume
  )
  score += volumeEfficiency * 30

  // Factor 4: Deadline proximity
  if (order.deadline) {
    const hoursUntilDeadline = 
      (order.deadline.getTime() - Date.now()) / (1000 * 60 * 60)
    
    if (hoursUntilDeadline < 24) {
      score += 50 // urgente
    } else if (hoursUntilDeadline < 48) {
      score += 25
    }
  }

  return score
}

/**
 * Verifica si el modelo cabe en el volumen de construcción
 */
function canFitInBuildVolume(
  dimensions: { width: number; height: number; depth: number },
  buildVolume: { width: number; height: number; depth: number }
): boolean {
  return (
    dimensions.width <= buildVolume.width &&
    dimensions.height <= buildVolume.height &&
    dimensions.depth <= buildVolume.depth
  )
}

/**
 * Calcula eficiencia del uso del volumen (0-1)
 * Más cercano a 1 = mejor ajuste
 */
function calculateVolumeEfficiency(
  dimensions: { width: number; height: number; depth: number },
  buildVolume: { width: number; height: number; depth: number }
): number {
  const orderVolume = dimensions.width * dimensions.height * dimensions.depth
  const printerVolume = buildVolume.width * buildVolume.height * buildVolume.depth
  
  const ratio = orderVolume / printerVolume
  
  // Penalizar si es demasiado pequeño (desperdicio) o muy grande
  if (ratio < 0.1) return ratio * 5 // muy pequeño
  if (ratio > 0.8) return 0.8 // cerca del límite
  
  return ratio
}

/**
 * Busca una impresora que pueda cumplir con el deadline
 */
function findPrinterMeetingDeadline(
  printers: Printer[],
  order: Order
): Printer | null {
  if (!order.deadline) return null

  for (const printer of printers) {
    const now = new Date()
    let startTime = now

    if (printer.currentJob) {
      startTime = printer.currentJob.estimatedCompletion
    }

    const completion = new Date(
      startTime.getTime() + (order.estimatedTime * 60 * 60 * 1000)
    )

    if (completion <= order.deadline) {
      return printer
    }
  }

  return null
}

/**
 * Obtiene cola de impresión para una impresora
 */
export async function getPrinterQueue(printerId: string): Promise<Order[]> {
  // TODO: Implementar en backend
  return []
}

/**
 * Re-asigna todas las órdenes pendientes de forma óptima
 */
export async function optimizeAllAssignments(
  orders: Order[],
  printers: Printer[]
): Promise<Map<string, string>> {
  const assignments = new Map<string, string>() // orderId -> printerId

  // Ordenar órdenes por prioridad y deadline
  const sortedOrders = orders.sort((a, b) => {
    const priorityWeight = {
      'urgent': 4,
      'high': 3,
      'normal': 2,
      'low': 1
    }

    if (a.priority !== b.priority) {
      return priorityWeight[b.priority] - priorityWeight[a.priority]
    }

    if (a.deadline && b.deadline) {
      return a.deadline.getTime() - b.deadline.getTime()
    }

    return a.created_at.getTime() - b.created_at.getTime()
  })

  // Asignar cada orden
  for (const order of sortedOrders) {
    const result = await autoAssignOrder(order, printers)
    if (result.success && result.printerId) {
      assignments.set(order.id, result.printerId)
      
      // Actualizar estado de la impresora para siguientes asignaciones
      const printer = printers.find(p => p.id === result.printerId)
      if (printer && result.estimatedCompletion) {
        printer.status = 'busy'
        printer.currentJob = {
          orderId: order.id,
          estimatedCompletion: result.estimatedCompletion
        }
      }
    }
  }

  return assignments
}
