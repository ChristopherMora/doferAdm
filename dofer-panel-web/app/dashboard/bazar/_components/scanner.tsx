'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Camera,
} from 'lucide-react'
import {
  DialogBackdrop,
  DialogHeader,
} from './dialog'

export function InlineScanner({
  onClose,
  onDetected,
}: {
  onClose: () => void
  onDetected: (value: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [scannerError, setScannerError] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    const start = async () => {
      const Detector = (window as unknown as {
        BarcodeDetector?: new (options?: { formats?: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
        }
      }).BarcodeDetector
      if (!Detector) {
        setScannerError('Captura el código con el lector o teclado.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (!videoRef.current || stopped) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
        })
        const scan = async () => {
          if (stopped || !videoRef.current) return
          try {
            const results = await detector.detect(videoRef.current)
            if (results[0]?.rawValue) {
              onDetected(results[0].rawValue)
              return
            }
          } catch {
            // La cámara puede entregar cuadros incompletos durante el arranque.
          }
          frame = requestAnimationFrame(scan)
        }
        frame = requestAnimationFrame(scan)
      } catch {
        setScannerError('No se pudo abrir la cámara.')
      }
    }
    void start()
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onDetected])

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-card">
      <DialogHeader eyebrow="Código de barras o QR" title="Escanear producto" onClose={onClose} />
      <div className="space-y-4 p-5">
        <div className="relative aspect-video overflow-hidden rounded-md bg-black">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-10 top-1/2 border-t-2 border-cyan-400" />
          <Camera className="absolute bottom-3 right-3 h-5 w-5 text-white/80" />
        </div>
        {scannerError && <p className="text-sm text-amber-700">{scannerError}</p>}
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && manualCode.trim()) {
                event.preventDefault()
                onDetected(manualCode.trim())
              }
            }}
            autoFocus={Boolean(scannerError)}
            placeholder="Código"
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3"
          />
          <button
            type="button"
            onClick={() => manualCode.trim() && onDetected(manualCode.trim())}
            disabled={!manualCode.trim()}
            className="h-11 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40"
          >
            Buscar
          </button>
        </div>
      </div>
    </div>
  )
}

export function ScannerDialog({
  onClose,
  onDetected,
}: {
  onClose: () => void
  onDetected: (value: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [scannerError, setScannerError] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false

    const start = async () => {
      const Detector = (window as unknown as {
        BarcodeDetector?: new (options?: { formats?: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
        }
      }).BarcodeDetector
      if (!Detector) {
        setScannerError('Este navegador no permite lectura automática. Captura el código manualmente.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (!videoRef.current || stopped) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
        })
        const scan = async () => {
          if (stopped || !videoRef.current) return
          try {
            const results = await detector.detect(videoRef.current)
            if (results[0]?.rawValue) {
              onDetected(results[0].rawValue)
              return
            }
          } catch {
            // Algunos navegadores fallan mientras el video todavía se inicializa.
          }
          frame = requestAnimationFrame(scan)
        }
        frame = requestAnimationFrame(scan)
      } catch {
        setScannerError('No se pudo abrir la cámara. Revisa el permiso o captura el código manualmente.')
      }
    }

    void start()
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onDetected])

  return (
    <DialogBackdrop onClose={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-t-lg border border-border bg-card shadow-2xl sm:rounded-lg">
        <DialogHeader eyebrow="Código de barras o QR" title="Buscar con cámara" onClose={onClose} />
        <div className="space-y-4 p-5">
          <div className="relative aspect-video overflow-hidden rounded-md bg-black">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-10 top-1/2 border-t-2 border-cyan-400" />
            <Camera className="absolute bottom-3 right-3 h-5 w-5 text-white/80" />
          </div>
          {scannerError && <p className="text-sm text-amber-700 dark:text-amber-300">{scannerError}</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (manualCode.trim()) onDetected(manualCode.trim())
            }}
            className="flex gap-2"
          >
            <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Escribe o pega el código" className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3" />
            <button type="submit" disabled={!manualCode.trim()} className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50">Buscar</button>
          </form>
        </div>
      </div>
    </DialogBackdrop>
  )
}
