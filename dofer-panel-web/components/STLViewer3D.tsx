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

  useEffect(() => {
    if (!containerRef.current) return
    
    let mounted = true
    let renderer: THREE.WebGLRenderer | null = null
    let animationId: number | null = null
    
    console.log('🎨 Iniciando visor 3D para archivo:', file.name, 'Tamaño:', file.size, 'bytes')

    // Setup scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)

    // Setup camera
    const width = containerRef.current.clientWidth || 800
    const height = containerRef.current.clientHeight || 600
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(0, 50, 100)
    camera.lookAt(0, 0, 0)

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
          
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 text-xs space-y-1 shadow-lg z-10">
            <p className="font-semibold text-gray-900">🖱️ Controles:</p>
            <p className="text-gray-600">• Click izq. + arrastrar: Rotar</p>
            <p className="text-gray-600">• Rueda: Zoom</p>
            <p className="text-gray-600">• Click der. + arrastrar: Mover</p>
          </div>
        </div>
      </div>
    </div>
  )
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
