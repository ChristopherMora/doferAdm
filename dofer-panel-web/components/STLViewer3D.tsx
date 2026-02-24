'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface STLViewer3DProps {
  file: File
  onClose: () => void
}

export default function STLViewer3D({ file, onClose }: STLViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadingModel, setLoadingModel] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modelDimensions, setModelDimensions] = useState<{ x: number; y: number; z: number } | null>(null)
  const [showSupports, setShowSupports] = useState(false)
  const [measuringMode, setMeasuringMode] = useState(false)
  const [measurementPoints, setMeasurementPoints] = useState<THREE.Vector3[]>([])
  const [measurementDistance, setMeasurementDistance] = useState<number | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const modelMeshRef = useRef<THREE.Mesh | null>(null)
  const supportsGroupRef = useRef<THREE.Group | null>(null)
  const measurementMarkersRef = useRef<THREE.Group | null>(null)
  const initialCameraPos = useRef<THREE.Vector3 | null>(null)
  const initialTarget = useRef<THREE.Vector3 | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())

  useEffect(() => {
    if (!containerRef.current) return
    
    let mounted = true
    let renderer: THREE.WebGLRenderer | null = null
    let animationId: number | null = null
    
    console.log('🎨 Iniciando visor 3D para archivo:', file.name, 'Tamaño:', file.size, 'bytes')

    // Setup scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)
    sceneRef.current = scene

    // Setup camera
    const width = containerRef.current.clientWidth || 800
    const height = containerRef.current.clientHeight || 600
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(0, 50, 100)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Setup renderer
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    
    // Asegurar que el canvas sea visible y ocupe todo el espacio
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0'
    renderer.domElement.style.left = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    
    containerRef.current.appendChild(renderer.domElement)
    console.log('✅ Renderer creado y añadido:', width, 'x', height, 'Canvas style:', renderer.domElement.style.cssText)

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
    directionalLight2.position.set(-1, -1, -0.5)
    scene.add(directionalLight2)

    // Grid se agregará después de conocer el tamaño del modelo

    // Load STL
    console.log('📂 Preparando lectura de archivo...')
    const reader = new FileReader()
    
    reader.onerror = () => {
      console.error('❌ Error al leer el archivo')
      setLoadError('Error al leer el archivo')
      setLoadingModel(false)
    }
    
    reader.onload = (event) => {
      console.log('📥 FileReader onload ejecutado')
      const arrayBuffer = event.target?.result as ArrayBuffer
      if (!arrayBuffer) {
        console.error('❌ No se pudo leer el archivo - arrayBuffer vacío')
        setLoadError('No se pudo leer el archivo')
        setLoadingModel(false)
        return
      }

      if (!mounted) {
        console.log('⚠️ Componente desmontado, cancelando carga')
        return
      }

      console.log('📦 Archivo cargado, tamaño:', arrayBuffer.byteLength, 'bytes')

      try {
        const geometry = parseSTLGeometry(arrayBuffer)
        const vertexCount = geometry.attributes.position?.count || 0
        console.log('✅ Geometría parseada, vértices:', vertexCount)
        
        if (vertexCount === 0) {
          console.error('❌ La geometría no tiene vértices')
          setLoadError('El archivo STL está vacío o es inválido')
          setLoadingModel(false)
          return
        }
        
        if (!mounted) return
        
        // Center geometry
        geometry.center()
        geometry.computeVertexNormals()

        // Create mesh
        const material = new THREE.MeshPhongMaterial({
          color: 0x4f46e5,
          specular: 0x111111,
          shininess: 200,
          flatShading: false,
        })
        
        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)
        modelMeshRef.current = mesh
        console.log('✅ Mesh añadido a la escena')

        // Calcular tamaño del modelo primero
        const box = new THREE.Box3().setFromObject(mesh)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        
        console.log('📐 Tamaño del modelo:', {
          x: size.x.toFixed(2),
          y: size.y.toFixed(2),
          z: size.z.toFixed(2),
          maxDim: maxDim.toFixed(2)
        })
        
        // Guardar dimensiones para mostrar en UI
        setModelDimensions({ x: size.x, y: size.y, z: size.z })
        
        // Generar soportes
        const supportsGroup = generateSupports(mesh, box)
        supportsGroup.visible = false
        scene.add(supportsGroup)
        supportsGroupRef.current = supportsGroup
        
        // Crear grupo para marcadores de medición
        const markersGroup = new THREE.Group()
        scene.add(markersGroup)
        measurementMarkersRef.current = markersGroup
        
        // Agregar grid proporcional al modelo
        const gridSize = Math.max(maxDim * 3, 10)
        const gridDivisions = 20
        const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x888888, 0xcccccc)
        gridHelper.position.y = box.min.y
        scene.add(gridHelper)
        console.log('✅ Grid agregado con tamaño:', gridSize.toFixed(2))

        // Add wireframe (opcional, más sutil)
        const edges = new THREE.EdgesGeometry(geometry)
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
          color: 0x000000,
          opacity: 0.2,
          transparent: true 
        }))
        scene.add(line)

        // Posicionar cámara para ver el modelo completo
        const distance = maxDim * 2.5
        const cameraHeight = maxDim * 0.8
        camera.position.set(distance, cameraHeight, distance)
        camera.lookAt(center)
        controls.target.copy(center)
        controls.update()
        
        // Guardar posición inicial para reset
        initialCameraPos.current = camera.position.clone()
        initialTarget.current = center.clone()
        
        console.log('✅ Cámara ajustada - Posición:', {
          x: camera.position.x.toFixed(2),
          y: camera.position.y.toFixed(2),
          z: camera.position.z.toFixed(2)
        }, 'Target:', {
          x: center.x.toFixed(2),
          y: center.y.toFixed(2),
          z: center.z.toFixed(2)
        })
        
        // Forzar un render inmediato
        renderer.render(scene, camera)
        console.log('✅ Render inicial forzado')
        
        setLoadingModel(false)
      } catch (error) {
        console.error('❌ Error cargando STL:', error)
        setLoadError(error instanceof Error ? error.message : 'Error desconocido al parsear STL')
        setLoadingModel(false)
      }
    }
    
    console.log('🚀 Iniciando lectura del archivo...')
    reader.readAsArrayBuffer(file)

    // Animation loop
    const animate = () => {
      if (!mounted) return
      animationId = requestAnimationFrame(animate)
      controls.update()
      renderer!.render(scene, camera)
    }
    animate()
    console.log('✅ Loop de animación iniciado')

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !mounted || !renderer) return
      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      mounted = false
      window.removeEventListener('resize', handleResize)
      
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
      
      if (renderer) {
        renderer.dispose()
      }
      
      // No intentar remover nada del DOM, dejar que React lo maneje
    }
  }, [file])

  // Control functions
  const resetView = () => {
    if (controlsRef.current && cameraRef.current && initialCameraPos.current && initialTarget.current) {
      cameraRef.current.position.copy(initialCameraPos.current)
      controlsRef.current.target.copy(initialTarget.current)
      controlsRef.current.update()
    }
  }

  const zoomIn = () => {
    if (cameraRef.current && controlsRef.current) {
      const direction = new THREE.Vector3()
      cameraRef.current.getWorldDirection(direction)
      cameraRef.current.position.addScaledVector(direction, 10)
      controlsRef.current.update()
    }
  }

  const zoomOut = () => {
    if (cameraRef.current && controlsRef.current) {
      const direction = new THREE.Vector3()
      cameraRef.current.getWorldDirection(direction)
      cameraRef.current.position.addScaledVector(direction, -10)
      controlsRef.current.update()
    }
  }

  const viewTop = () => {
    if (cameraRef.current && controlsRef.current && initialTarget.current) {
      const distance = cameraRef.current.position.distanceTo(initialTarget.current)
      cameraRef.current.position.set(initialTarget.current.x, initialTarget.current.y + distance, initialTarget.current.z)
      controlsRef.current.update()
    }
  }

  const viewFront = () => {
    if (cameraRef.current && controlsRef.current && initialTarget.current) {
      const distance = cameraRef.current.position.distanceTo(initialTarget.current)
      cameraRef.current.position.set(initialTarget.current.x, initialTarget.current.y, initialTarget.current.z + distance)
      controlsRef.current.update()
    }
  }

  const viewSide = () => {
    if (cameraRef.current && controlsRef.current && initialTarget.current) {
      const distance = cameraRef.current.position.distanceTo(initialTarget.current)
      cameraRef.current.position.set(initialTarget.current.x + distance, initialTarget.current.y, initialTarget.current.z)
      controlsRef.current.update()
    }
  }

  // Toggle functions
  const toggleSupports = () => {
    if (supportsGroupRef.current) {
      supportsGroupRef.current.visible = !supportsGroupRef.current.visible
      setShowSupports(!showSupports)
    }
  }

  const toggleMeasuring = () => {
    setMeasuringMode(!measuringMode)
    setMeasurementPoints([])
    setMeasurementDistance(null)
    if (measurementMarkersRef.current) {
      measurementMarkersRef.current.clear()
    }
  }

  // Effect for canvas click handling
  useEffect(() => {
    if (!containerRef.current || !measuringMode) return

    const canvas = containerRef.current.querySelector('canvas')
    if (!canvas) return

    const handleClick = (event: MouseEvent) => {
      if (!modelMeshRef.current || !cameraRef.current) return
      
      const rect = canvas.getBoundingClientRect()
      const mouse = new THREE.Vector2()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      
      raycasterRef.current.setFromCamera(mouse, cameraRef.current)
      const intersects = raycasterRef.current.intersectObject(modelMeshRef.current)
      
      if (intersects.length > 0) {
        const point = intersects[0].point
        setMeasurementPoints(prev => {
          const newPoints = [...prev, point]
          if (newPoints.length === 2) {
            const distance = newPoints[0].distanceTo(newPoints[1])
            setMeasurementDistance(distance)
            updateMeasurementMarkers(newPoints)
            return []
          } else if (newPoints.length > 2) {
            if (measurementMarkersRef.current) measurementMarkersRef.current.clear()
            setMeasurementDistance(null)
            return [point]
          }
          updateMeasurementMarkers(newPoints)
          return newPoints
        })
      }
    }

    const updateMeasurementMarkers = (points: THREE.Vector3[]) => {
      if (!measurementMarkersRef.current) return
      
      measurementMarkersRef.current.clear()
      
      points.forEach((point) => {
        const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16)
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
        sphere.position.copy(point)
        measurementMarkersRef.current!.add(sphere)
      })
      
      if (points.length === 2) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
        const line = new THREE.Line(lineGeometry, lineMaterial)
        measurementMarkersRef.current.add(line)
      }
    }

    canvas.addEventListener('click', handleClick)
    return () => {
      canvas.removeEventListener('click', handleClick)
    }
  }, [measuringMode])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">🎨 Vista 3D del Modelo</h2>
            <p className="text-sm text-gray-600">{file.name}</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            ✕ Cerrar
          </button>
        </div>

        {/* 3D Viewer */}
        <div ref={containerRef} className="flex-1 relative bg-gray-50" style={{ minHeight: '500px' }}>
          {loadingModel && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-700 font-medium">Cargando modelo 3D...</p>
              </div>
            </div>
          )}
          
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center max-w-md p-6">
                <p className="text-red-600 font-medium mb-2">❌ Error al cargar el modelo</p>
                <p className="text-gray-600 text-sm">{loadError}</p>
              </div>
            </div>
          )}
          
          {/* View Controls */}
          {!loadingModel && !loadError && (
            <>
              {/* Dimensions Panel */}
              {modelDimensions && (
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg p-3 text-xs shadow-lg z-10 space-y-2">
                  <p className="font-semibold text-gray-900 border-b pb-1">📐 Dimensiones</p>
                  <div className="space-y-1">
                    <p className="text-gray-600">Ancho (X): <span className="font-bold text-indigo-600">{modelDimensions.x.toFixed(2)} mm</span></p>
                    <p className="text-gray-600">Altura (Y): <span className="font-bold text-indigo-600">{modelDimensions.y.toFixed(2)} mm</span></p>
                    <p className="text-gray-600">Profundidad (Z): <span className="font-bold text-indigo-600">{modelDimensions.z.toFixed(2)} mm</span></p>
                  </div>
                </div>
              )}
              
              {/* Control Buttons */}
              <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg p-2 shadow-lg z-10 space-y-2">
                <p className="font-semibold text-gray-900 text-xs mb-2 px-1">🎮 Controles</p>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={resetView}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded transition"
                    title="Restaurar vista inicial"
                  >
                    🔄 Reset
                  </button>
                  <button
                    onClick={zoomIn}
                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition"
                    title="Acercar"
                  >
                    🔍+
                  </button>
                  <button
                    onClick={zoomOut}
                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition"
                    title="Alejar"
                  >
                    🔍-
                  </button>
                  <button
                    onClick={viewTop}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition"
                    title="Vista superior"
                  >
                    ⬆️ Top
                  </button>
                  <button
                    onClick={viewFront}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition"
                    title="Vista frontal"
                  >
                    👁️ Front
                  </button>
                  <button
                    onClick={viewSide}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition"
                    title="Vista lateral"
                  >
                    ↔️ Side
                  </button>
                </div>
                <div className="border-t pt-2 mt-2 space-y-1">
                  <button
                    onClick={toggleSupports}
                    className={`w-full px-3 py-1.5 ${showSupports ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-500 hover:bg-gray-600'} text-white text-xs rounded transition`}
                    title="Mostrar/ocultar soportes"
                  >
                    {showSupports ? '🏗️ Ocultar soportes' : '🏗️ Ver soportes'}
                  </button>
                  <button
                    onClick={toggleMeasuring}
                    className={`w-full px-3 py-1.5 ${measuringMode ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'} text-white text-xs rounded transition`}
                    title="Activar/desactivar modo medición"
                  >
                    {measuringMode ? '📏 Desactivar medición' : '📏 Medir distancias'}
                  </button>
                  {measurementDistance !== null && (
                    <div className="bg-yellow-100 border border-yellow-400 rounded px-2 py-1 text-center">
                      <p className="text-xs font-semibold text-yellow-900">
                        📐 {measurementDistance.toFixed(2)} mm
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 text-xs space-y-1 shadow-lg z-10">
            <p className="font-semibold text-gray-900">🖱️ Controles:</p>
            <p className="text-gray-600">• Click izq. + arrastrar: Rotar</p>
            <p className="text-gray-600">• Rueda: Zoom</p>
            <p className="text-gray-600">• Click der. + arrastrar: Mover</p>
            {measuringMode && (
              <p className="text-amber-700 font-medium border-t pt-1 mt-1">
                📏 Modo medición: Click 2 puntos ({measurementPoints.length}/2)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Generate support structures
function generateSupports(mesh: THREE.Mesh, boundingBox: THREE.Box3): THREE.Group {
  const supportsGroup = new THREE.Group()
  const size = boundingBox.getSize(new THREE.Vector3())
  const min = boundingBox.min
  
  // Material for supports
  const supportMaterial = new THREE.MeshPhongMaterial({
    color: 0xff6b6b,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
  })
  
  // Get geometry positions to analyze overhangs
  const geometry = mesh.geometry
  const positions = geometry.attributes.position
  
  // Create a grid of potential support points
  const gridResolution = 10
  const stepX = size.x / gridResolution
  const stepZ = size.z / gridResolution
  
  for (let i = 0; i <= gridResolution; i++) {
    for (let j = 0; j <= gridResolution; j++) {
      const x = min.x + i * stepX
      const z = min.z + j * stepZ
      
      // Find lowest point of model at this x,z position
      let lowestY = Infinity
      let foundPoint = false
      
      for (let k = 0; k < positions.count; k++) {
        const vx = positions.getX(k)
        const vy = positions.getY(k)
        const vz = positions.getZ(k)
        
        // Check if vertex is near this grid position
        if (Math.abs(vx - x) < stepX / 2 && Math.abs(vz - z) < stepZ / 2) {
          if (vy < lowestY) {
            lowestY = vy
            foundPoint = true
          }
        }
      }
      
      // If point is significantly above base, add support
      if (foundPoint && lowestY > min.y + size.y * 0.1) {
        const supportHeight = lowestY - min.y
        const supportRadius = Math.min(stepX, stepZ) * 0.15
        
        // Create cylindrical support
        const supportGeometry = new THREE.CylinderGeometry(
          supportRadius,
          supportRadius * 1.5,
          supportHeight,
          8
        )
        const support = new THREE.Mesh(supportGeometry, supportMaterial)
        support.position.set(x, min.y + supportHeight / 2, z)
        supportsGroup.add(support)
      }
    }
  }
  
  console.log(`✅ Generados ${supportsGroup.children.length} soportes`)
  return supportsGroup
}

// Parse STL geometry from ArrayBuffer
function parseSTLGeometry(buffer: ArrayBuffer): THREE.BufferGeometry {
  const view = new DataView(buffer)
  const isASCII = buffer.byteLength > 5 && 
    view.getUint8(0) === 115 && // 's'
    view.getUint8(1) === 111 && // 'o'
    view.getUint8(2) === 108 && // 'l'
    view.getUint8(3) === 105 && // 'i'
    view.getUint8(4) === 100    // 'd'

  if (isASCII) {
    return parseASCIISTL(new TextDecoder().decode(buffer))
  } else {
    return parseBinarySTL(buffer)
  }
}

function parseBinarySTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const view = new DataView(buffer)
  const triangleCount = view.getUint32(80, true)
  
  const vertices: number[] = []
  const normals: number[] = []
  
  let offset = 84
  for (let i = 0; i < triangleCount; i++) {
    // Normal
    const nx = view.getFloat32(offset, true)
    const ny = view.getFloat32(offset + 4, true)
    const nz = view.getFloat32(offset + 8, true)
    offset += 12
    
    // 3 vertices
    for (let j = 0; j < 3; j++) {
      vertices.push(view.getFloat32(offset, true))
      vertices.push(view.getFloat32(offset + 4, true))
      vertices.push(view.getFloat32(offset + 8, true))
      normals.push(nx, ny, nz)
      offset += 12
    }
    
    offset += 2 // Skip attribute byte count
  }
  
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  
  return geometry
}

function parseASCIISTL(text: string): THREE.BufferGeometry {
  const vertices: number[] = []
  const vertexPattern = /vertex\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/g
  
  let match
  while ((match = vertexPattern.exec(text)) !== null) {
    vertices.push(parseFloat(match[1]))
    vertices.push(parseFloat(match[3]))
    vertices.push(parseFloat(match[5]))
  }
  
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  
  return geometry
}
