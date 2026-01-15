'use client'

import { useState, useRef } from 'react'
import { parseSTL, formatMetrics, MATERIAL_DENSITIES, type STLMetrics } from '@/lib/stlParser'
import { Upload, Loader2, X } from 'lucide-react'

interface STLUploaderProps {
  onAnalyzed?: (metrics: STLMetrics, weight: number) => void
}

export default function STLUploader({ onAnalyzed }: STLUploaderProps) {
  const [metrics, setMetrics] = useState<STLMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [selectedMaterial, setSelectedMaterial] = useState<string>('PLA')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar extensión
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setError('Solo se aceptan archivos STL')
      return
    }

    setError('')
    setLoading(true)
    setFileName(file.name)

    try {
      const parsed = await parseSTL(file)
      setMetrics(parsed)

      // Calcular peso con material seleccionado
      const volumeCm3 = parsed.volume / 1000
      const density = MATERIAL_DENSITIES[selectedMaterial] || MATERIAL_DENSITIES['PLA']
      const weight = volumeCm3 * density

      if (onAnalyzed) {
        onAnalyzed(parsed, weight)
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
        handleFileSelect({ target: input } as any)
      }
    }
  }

  const handleMaterialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMaterial(e.target.value)
    if (metrics) {
      const volumeCm3 = metrics.volume / 1000
      const density = MATERIAL_DENSITIES[e.target.value] || MATERIAL_DENSITIES['PLA']
      const weight = volumeCm3 * density
      if (onAnalyzed) {
        onAnalyzed(metrics, weight)
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
  const weight = volumeCm3 * density

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold text-gray-900">📤 Análisis de Archivo STL</h2>
        <p className="text-sm text-gray-600 mt-1">Sube un archivo STL para analizar peso, volumen y dimensiones</p>
      </div>

      {/* Upload Area */}
      {!metrics ? (
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
            className="hidden"
          />

          {loading ? (
            <div className="space-y-3">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-blue-500" />
              <p className="text-gray-600">Analizando archivo STL...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-12 h-12 mx-auto text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900">Haz clic o arrastra un archivo STL</p>
                <p className="text-sm text-gray-600 mt-1">Soporta formatos ASCII y Binary</p>
              </div>
            </div>
          )}
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

          {/* Material Selection */}
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

          {/* Metrics Grid */}
          {formattedMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Peso */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Peso Estimado</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{weight.toFixed(2)} g</p>
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
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}
    </div>
  )
}
