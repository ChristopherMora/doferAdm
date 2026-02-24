'use client'

import { useState, useRef } from 'react'
import { parseSTL, formatMetrics, MATERIAL_DENSITIES, type STLMetrics } from '@/lib/stlParser'
import { Upload, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const STLViewer3D = dynamic(() => import('./STLViewer3D'), { ssr: false })

interface STLUploaderProps {
  onAnalyzed?: (metrics: STLMetrics, weight: number, estimatedTimeHours: number) => void
}

export default function STLUploader({ onAnalyzed }: STLUploaderProps) {
  const router = useRouter()
  const [metrics, setMetrics] = useState<STLMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [selectedMaterial, setSelectedMaterial] = useState<string>('PLA')
  const [infillPercentage, setInfillPercentage] = useState<number>(15)
  const [estimatedTime, setEstimatedTime] = useState<number>(0)
  const [showComparison, setShowComparison] = useState<boolean>(false)
  const [multipleFiles, setMultipleFiles] = useState<Array<{name: string, metrics: STLMetrics, weight: number, time: number}>>([])
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false)
  const [show3DViewer, setShow3DViewer] = useState<boolean>(false)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Exportar a PDF
  const exportToPDF = () => {
    if (!metrics) return
    
    const formatted = formatMetrics(metrics)
    
    const doc = {
      title: 'Cotización de Impresión 3D',
      filename: `cotizacion_${fileName.replace('.stl', '')}.txt`,
      content: `
═══════════════════════════════════════════════════════
        COTIZACIÓN DE IMPRESIÓN 3D - DOFER
═══════════════════════════════════════════════════════

ARCHIVO: ${fileName}
FECHA: ${new Date().toLocaleDateString('es-MX')}

───────────────────────────────────────────────────────
ESPECIFICACIONES DEL MODELO
───────────────────────────────────────────────────────
• Volumen: ${formatted.volumeCm3} cm³
• Dimensiones: ${formatted.width} × ${formatted.height} × ${formatted.depth}
• Triángulos: ${formatted.triangles}

───────────────────────────────────────────────────────
CONFIGURACIÓN DE IMPRESIÓN
───────────────────────────────────────────────────────
• Material: ${selectedMaterial}
• Relleno: ${infillPercentage}%
• Peso estimado: ${weight.toFixed(2)} g
• Tiempo estimado: ${estimatedTime < 1 ? `${Math.round(estimatedTime * 60)} minutos` : `${estimatedTime.toFixed(1)} horas`}

───────────────────────────────────────────────────────
ANÁLISIS DE MATERIAL
───────────────────────────────────────────────────────
• Peso del modelo: ${weight.toFixed(2)} g
• Porcentaje del rollo (1kg): ${((weight / 1000) * 100).toFixed(2)}%
• Modelos por rollo: ${Math.floor(1000 / weight)} piezas
• Costo material (rollo $400): $${((weight / 1000) * 400).toFixed(2)} MXN

───────────────────────────────────────────────────────
COMPARACIÓN DE MATERIALES
───────────────────────────────────────────────────────
${Object.entries(MATERIAL_DENSITIES).map(([mat, dens]) => {
  const vol = metrics.volume / 1000
  const fill = 0.90 + (infillPercentage / 100) * 0.10
  const matWeight = vol * dens * Math.min(fill, 1.0)
  return `${mat.padEnd(10)} | ${dens} g/cm³ | ${matWeight.toFixed(2)} g`
}).join('\n')}

═══════════════════════════════════════════════════════
         Esta es una cotización estimada
       Los valores pueden variar según configuración
═══════════════════════════════════════════════════════
      `
    }
    
    // Crear blob y descargar
    const blob = new Blob([doc.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Crear cotización con los datos del STL
  const createQuote = () => {
    if (!metrics) return
    
    // Guardar datos en sessionStorage para pre-llenar la cotización
    const quoteData = {
      productName: fileName.replace('.stl', ''),
      material: selectedMaterial,
      weight: weight.toFixed(2),
      printTime: estimatedTime.toFixed(2),
      infill: infillPercentage,
      volume: (metrics.volume / 1000).toFixed(2),
      dimensions: `${metrics.dimensions.width.toFixed(1)}×${metrics.dimensions.height.toFixed(1)}×${metrics.dimensions.depth.toFixed(1)}mm`
    }
    
    sessionStorage.setItem('stl_quote_data', JSON.stringify(quoteData))
    router.push('/dashboard/quotes?action=new')
  }

  // Presets de configuración
  const presets = {
    draft: { name: 'Borrador Rápido', infill: 10, icon: '⚡' },
    standard: { name: 'Calidad Estándar', infill: 15, icon: '✓' },
    quality: { name: 'Alta Calidad', infill: 20, icon: '⭐' },
    strength: { name: 'Alta Resistencia', infill: 50, icon: '💪' }
  }

  const applyPreset = (presetKey: keyof typeof presets) => {
    const preset = presets[presetKey]
    setInfillPercentage(preset.infill)
    if (metrics) {
      const volumeCm3 = metrics.volume / 1000
      const density = MATERIAL_DENSITIES[selectedMaterial] || MATERIAL_DENSITIES['PLA']
      const fillPercentage = 0.90 + (preset.infill / 100) * 0.10
      const weight = volumeCm3 * density * Math.min(fillPercentage, 1.0)
      const timeHours = calculatePrintTime(metrics, preset.infill)
      setEstimatedTime(timeHours)
      if (onAnalyzed) {
        onAnalyzed(metrics, weight, timeHours)
      }
    }
  }

  // Calcular tiempo estimado de impresión
  const calculatePrintTime = (metrics: STLMetrics, infill: number): number => {
    // Parámetros de impresión típicos
    const layerHeight = 0.2 // mm
    const printSpeed = 50 // mm/s (velocidad promedio)
    const wallSpeed = 40 // mm/s (paredes más lentas)
    const infillSpeed = 60 // mm/s (relleno más rápido)
    
    // Calcular número de capas
    const heightMm = metrics.dimensions.depth
    const numLayers = Math.ceil(heightMm / layerHeight)
    
    // Estimar distancia de extrusión
    // Perímetro aproximado por capa
    const perimeterLength = 2 * (metrics.dimensions.width + metrics.dimensions.height)
    const wallLines = 2 // 2 líneas de pared típicamente
    const totalWallDistance = perimeterLength * wallLines * numLayers
    
    // Distancia de infill (basada en área de la capa y densidad)
    const layerArea = (metrics.dimensions.width * metrics.dimensions.height) / 100 // cm²
    const infillPattern = layerArea * (infill / 100) * 1.5 // factor de patrón
    const totalInfillDistance = infillPattern * numLayers * 10 // a mm
    
    // Top/Bottom layers (típicamente 4 capas arriba y 4 abajo)
    const solidLayers = 8
    const solidDistance = layerArea * solidLayers * 10
    
    // Tiempo total en segundos
    const wallTime = totalWallDistance / wallSpeed
    const infillTime = totalInfillDistance / infillSpeed
    const solidTime = solidDistance / printSpeed
    const travelTime = numLayers * 2 // 2 segundos por capa para movimientos
    
    const totalSeconds = wallTime + infillTime + solidTime + travelTime
    const hours = totalSeconds / 3600
    
    // Agregar 10% de overhead (aceleración, retracciones, etc.)
    return hours * 1.1
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Modo batch si seleccionó múltiples archivos
    if (files.length > 1) {
      setIsBatchMode(true)
      setLoading(true)
      const processedFiles: Array<{name: string, metrics: STLMetrics, weight: number, time: number}> = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.name.toLowerCase().endsWith('.stl')) continue
        
        try {
          const parsed = await parseSTL(file)
          const volumeCm3 = parsed.volume / 1000
          const density = MATERIAL_DENSITIES[selectedMaterial] || MATERIAL_DENSITIES['PLA']
          const fillPercentage = 0.90 + (infillPercentage / 100) * 0.10
          const weight = volumeCm3 * density * Math.min(fillPercentage, 1.0)
          const timeHours = calculatePrintTime(parsed, infillPercentage)
          
          processedFiles.push({
            name: file.name,
            metrics: parsed,
            weight: weight,
            time: timeHours
          })
        } catch (err) {
          console.error(`Error processing ${file.name}:`, err)
        }
      }
      
      setMultipleFiles(processedFiles)
      setLoading(false)
      return
    }

    // Modo archivo único
    const file = files[0]
    if (!file) return

    // Validar extensión
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setError('Solo se aceptan archivos STL')
      return
    }

    setError('')
    setLoading(true)
    setFileName(file.name)
    setCurrentFile(file) // Guardar archivo para vista 3D

    try {
      const parsed = await parseSTL(file)
      setMetrics(parsed)

      // Calcular peso con material seleccionado, considerando configuración real de impresión
      const volumeCm3 = parsed.volume / 1000
      const density = MATERIAL_DENSITIES[selectedMaterial] || MATERIAL_DENSITIES['PLA']
      
      // Fórmula calibrada con laminadores reales
      // Factor alto porque en piezas pequeñas las paredes, techo y piso ocupan casi todo
      // Ajuste: 90% base (casi sólido) + pequeño ajuste por infill  
      const fillPercentage = 0.90 + (infillPercentage / 100) * 0.10
      const weight = volumeCm3 * density * Math.min(fillPercentage, 1.0)

      // Calcular tiempo estimado de impresión
      const timeHours = calculatePrintTime(parsed, infillPercentage)
      setEstimatedTime(timeHours)

      if (onAnalyzed) {
        onAnalyzed(parsed, weight, timeHours)
      }
    } catch (err) {
      setError(`Error al parsear STL: ${err instanceof Error ? err.message : 'Error desconocido'}`)
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      const input = fileInputRef.current
      if (input) {
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(file)
        input.files = dataTransfer.files
        handleFileSelect({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>)
      }
    }
  }

  const handleMaterialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMaterial(e.target.value)
    if (metrics) {
      const volumeCm3 = metrics.volume / 1000
      const density = MATERIAL_DENSITIES[e.target.value] || MATERIAL_DENSITIES['PLA']
      const fillPercentage = 0.90 + (infillPercentage / 100) * 0.10
      const weight = volumeCm3 * density * Math.min(fillPercentage, 1.0)
      if (onAnalyzed) {
        onAnalyzed(metrics, weight, estimatedTime)
      }
    }
  }

  const handleInfillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newInfill = parseFloat(e.target.value) || 15
    setInfillPercentage(newInfill)
    if (metrics) {
      const volumeCm3 = metrics.volume / 1000
      const density = MATERIAL_DENSITIES[selectedMaterial] || MATERIAL_DENSITIES['PLA']
      const fillPercentage = 0.90 + (newInfill / 100) * 0.10
      const weight = volumeCm3 * density * Math.min(fillPercentage, 1.0)
      
      // Recalcular tiempo con nuevo infill
      const timeHours = calculatePrintTime(metrics, newInfill)
      setEstimatedTime(timeHours)
      
      if (onAnalyzed) {
        onAnalyzed(metrics, weight, timeHours)
      }
    }
  }

  const resetUpload = () => {
    setMetrics(null)
    setFileName('')
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formattedMetrics = metrics ? formatMetrics(metrics) : null
  const volumeCm3 = metrics ? metrics.volume / 1000 : 0
  const density = MATERIAL_DENSITIES[selectedMaterial] || MATERIAL_DENSITIES['PLA']
  const fillPercentage = 0.90 + (infillPercentage / 100) * 0.10
  const weight = volumeCm3 * density * Math.min(fillPercentage, 1.0)
  const solidWeight = volumeCm3 * density

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold text-gray-900">📤 Análisis de Archivo STL</h2>
        <p className="text-sm text-gray-600 mt-1">Sube un archivo STL para analizar peso, volumen y dimensiones</p>
      </div>

      {/* Upload Area */}
      {!metrics && !isBatchMode ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl"
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />

          {loading ? (
            <div className="space-y-3">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-blue-500" />
              <p className="text-gray-600">Analizando archivo(s) STL...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-12 h-12 mx-auto text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900">Haz clic o arrastra archivo(s) STL</p>
                <p className="text-sm text-gray-600 mt-1">Soporta formatos ASCII y Binary</p>
                <p className="text-xs text-blue-600 mt-2">💡 Puedes subir múltiples archivos a la vez</p>
              </div>
            </div>
          )}
        </div>
      ) : isBatchMode ? (
        <div className="space-y-4">
          {/* Batch Mode Header */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-lg">📦 Modo Lote: {multipleFiles.length} archivos</p>
              <p className="text-sm opacity-90">Cotización combinada de múltiples modelos</p>
            </div>
            <button
              onClick={() => {
                setIsBatchMode(false)
                setMultipleFiles([])
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lista de archivos */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Archivo</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Peso</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Tiempo</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Volumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {multipleFiles.map((file, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{file.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{file.weight.toFixed(2)} g</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {file.time < 1 ? `${Math.round(file.time * 60)}m` : `${file.time.toFixed(1)}h`}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {(file.metrics.volume / 1000).toFixed(2)} cm³
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-green-50 border-t-2 border-green-200">
                <tr>
                  <td className="px-4 py-3 font-bold text-green-900">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-green-900">
                    {multipleFiles.reduce((sum, f) => sum + f.weight, 0).toFixed(2)} g
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-900">
                    {(() => {
                      const totalTime = multipleFiles.reduce((sum, f) => sum + f.time, 0)
                      return totalTime < 1 ? `${Math.round(totalTime * 60)}m` : `${totalTime.toFixed(1)}h`
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-900">
                    {multipleFiles.reduce((sum, f) => sum + (f.metrics.volume / 1000), 0).toFixed(2)} cm³
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Botones para batch */}
          <div className="flex gap-3">
            <button
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-md"
            >
              ✨ Crear Cotización de Lote
            </button>
            <button
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md"
            >
              📄 Exportar Resumen
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold text-green-900">✓ Archivo analizado</p>
              <p className="text-sm text-green-700">{fileName}</p>
            </div>
            <button
              onClick={resetUpload}
              className="text-green-600 hover:text-green-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Presets de configuración */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              🎯 Presets de Configuración
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(presets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key as keyof typeof presets)}
                  className={`px-3 py-2 rounded-lg border-2 transition-all ${
                    infillPercentage === preset.infill
                      ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="text-lg">{preset.icon}</div>
                  <div className="text-xs font-medium">{preset.name}</div>
                  <div className="text-xs text-gray-600">{preset.infill}%</div>
                </button>
              ))}
            </div>
          </div>

          {/* Material and Infill Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Material (para cálculo de peso)
              </label>
              <select
                value={selectedMaterial}
                onChange={handleMaterialChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
              >
                {Object.entries(MATERIAL_DENSITIES).map(([material, density]) => (
                  <option key={material} value={material}>
                    {material} ({density} g/cm³)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Relleno / Infill: {infillPercentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={infillPercentage}
                onChange={handleInfillChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0% (Hueco)</span>
                <span>50%</span>
                <span>100% (Sólido)</span>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          {formattedMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Peso */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Peso estimado</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{weight.toFixed(2)} g</p>
                <p className="text-xs text-blue-600 mt-1">Infill {infillPercentage}%</p>
                <p className="text-xs text-blue-500">Sólido: {solidWeight.toFixed(2)} g</p>
              </div>

              {/* Tiempo Estimado */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-sm text-indigo-600 font-medium">Tiempo estimado</p>
                <p className="text-2xl font-bold text-indigo-900 mt-1">
                  {estimatedTime < 1 
                    ? `${Math.round(estimatedTime * 60)}m` 
                    : `${estimatedTime.toFixed(1)}h`}
                </p>
                <p className="text-xs text-indigo-600 mt-1">
                  {Math.round(estimatedTime * 60)} minutos
                </p>
              </div>

              {/* Volumen */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-600 font-medium">Volumen</p>
                <p className="text-xl font-bold text-purple-900 mt-1">{formattedMetrics.volumeCm3}</p>
                <p className="text-xs text-purple-600">cm³</p>
              </div>

              {/* Triángulos */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium">Triángulos</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">{formattedMetrics.triangles}</p>
              </div>

              {/* Dimensiones */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Ancho</p>
                <p className="text-xl font-bold text-green-900 mt-1">{formattedMetrics.width}</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Alto</p>
                <p className="text-xl font-bold text-green-900 mt-1">{formattedMetrics.height}</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Profundidad</p>
                <p className="text-xl font-bold text-green-900 mt-1">{formattedMetrics.depth}</p>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setShow3DViewer(true)}
              className="flex-1 min-w-[200px] px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-md"
            >
              🎨 Ver en 3D
            </button>
            
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="flex-1 min-w-[200px] px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md"
            >
              📊 {showComparison ? 'Ocultar' : 'Comparar'} Materiales
            </button>
            
            <button
              onClick={createQuote}
              className="flex-1 min-w-[200px] px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-md"
            >
              ✨ Crear Cotización
            </button>
            
            <button
              onClick={exportToPDF}
              className="flex-1 min-w-[200px] px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all shadow-md"
            >
              📄 Exportar PDF
            </button>
          </div>

          {/* Tabla de comparación de materiales */}
          {showComparison && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3">
                <h3 className="font-bold text-white">📊 Comparación de Materiales</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Material</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Densidad</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Peso</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Tiempo</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Recomendación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(MATERIAL_DENSITIES).map(([material, density]) => {
                      const matWeight = volumeCm3 * density * fillPercentage
                      const isSelected = material === selectedMaterial
                      const recommendations: Record<string, string> = {
                        'PLA': 'Fácil, económico, ideal principiantes',
                        'ABS': 'Resistente al calor, durabilidad',
                        'PETG': 'Balance resistencia/flexibilidad',
                        'TPU': 'Flexible, ideal para gomas',
                        'NYLON': 'Muy resistente, uso industrial',
                        'Resin': 'Alta precisión, detalles finos'
                      }
                      return (
                        <tr key={material} className={isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {isSelected && '✓ '}{material}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">{density} g/cm³</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{matWeight.toFixed(2)} g</td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {estimatedTime < 1 ? `${Math.round(estimatedTime * 60)}m` : `${estimatedTime.toFixed(1)}h`}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500">{recommendations[material]}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Calculadora de costo por rollo */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 mb-2">💰 Costo de Material por Rollo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-amber-600">Peso del modelo:</p>
                <p className="font-bold text-amber-900">{weight.toFixed(2)} g</p>
              </div>
              <div>
                <p className="text-amber-600">De un rollo de 1kg:</p>
                <p className="font-bold text-amber-900">{Math.floor(1000 / weight)} piezas</p>
              </div>
              <div>
                <p className="text-amber-600">% del rollo usado:</p>
                <p className="font-bold text-amber-900">{((weight / 1000) * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-amber-600">Rollo a $400:</p>
                <p className="font-bold text-amber-900">${((weight / 1000) * 400).toFixed(2)} MXN</p>
              </div>
            </div>
          </div>

          {/* Análisis de Soportes */}
          {metrics?.supportAnalysis && (
            <div className={`rounded-lg p-4 border-2 ${
              metrics.supportAnalysis.needsSupport 
                ? 'bg-orange-50 border-orange-300' 
                : 'bg-green-50 border-green-300'
            }`}>
              <h3 className={`font-semibold mb-2 flex items-center gap-2 ${
                metrics.supportAnalysis.needsSupport ? 'text-orange-900' : 'text-green-900'
              }`}>
                {metrics.supportAnalysis.needsSupport ? '⚠️ Requiere Soportes' : '✅ No Requiere Soportes'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className={metrics.supportAnalysis.needsSupport ? 'text-orange-600' : 'text-green-600'}>
                    Overhangs detectados:
                  </p>
                  <p className={`font-bold ${metrics.supportAnalysis.needsSupport ? 'text-orange-900' : 'text-green-900'}`}>
                    {metrics.supportAnalysis.overhangTriangles} triángulos
                  </p>
                </div>
                {metrics.supportAnalysis.needsSupport && (
                  <>
                    <div>
                      <p className="text-orange-600">Material soporte est.:</p>
                      <p className="font-bold text-orange-900">
                        {metrics.supportAnalysis.supportWeight.toFixed(2)} g
                      </p>
                    </div>
                    <div>
                      <p className="text-orange-600">Peso total con soporte:</p>
                      <p className="font-bold text-orange-900">
                        {(weight + metrics.supportAnalysis.supportWeight).toFixed(2)} g
                      </p>
                    </div>
                  </>
                )}
              </div>
              {metrics.supportAnalysis.needsSupport && (
                <p className="text-xs text-orange-600 mt-2 italic">
                  💡 Considera rotar el modelo para reducir o eliminar soportes
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* 3D Viewer Modal */}
      {show3DViewer && currentFile && (
        <STLViewer3D 
          file={currentFile} 
          onClose={() => setShow3DViewer(false)} 
        />
      )}
    </div>
  )
}
