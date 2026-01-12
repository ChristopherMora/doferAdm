export default function BackendAlert() {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            ⚠️ Backend API no disponible
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>El servidor no está respondiendo. Esta funcionalidad requiere el backend corriendo.</p>
            
            <div className="mt-3 bg-yellow-100 rounded-md p-3">
              <p className="font-semibold mb-2">🔧 Para activar el backend:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>
                  <strong>Opción 1 - Supabase (Recomendado):</strong>
                  <ul className="list-disc list-inside ml-6 mt-1 text-xs">
                    <li>Crear proyecto en <a href="https://supabase.com" target="_blank" rel="noopener" className="underline">supabase.com</a></li>
                    <li>Aplicar migraciones SQL</li>
                    <li>Copiar credenciales a <code className="bg-yellow-200 px-1 rounded">dofer-panel-api/.env</code></li>
                  </ul>
                </li>
                <li className="mt-2">
                  <strong>Opción 2 - Docker:</strong>
                  <ul className="list-disc list-inside ml-6 mt-1 text-xs">
                    <li>Instalar Docker Desktop</li>
                    <li>Ejecutar: <code className="bg-yellow-200 px-1 rounded">cd dofer-panel-api && docker-compose up -d</code></li>
                  </ul>
                </li>
                <li className="mt-2">
                  <strong>Luego iniciar backend:</strong>
                  <br />
                  <code className="bg-yellow-200 px-2 py-1 rounded text-xs inline-block mt-1">
                    cd dofer-panel-api && go run cmd/api/main.go
                  </code>
                </li>
              </ol>
            </div>

            <div className="mt-3 pt-3 border-t border-yellow-300">
              <p className="text-xs">
                📚 <strong>Documentación:</strong>{' '}
                <span className="font-mono">ANALISIS_PROYECTO.md</span> • {' '}
                <span className="font-mono">SETUP_INSTRUCTIONS.md</span> • {' '}
                <span className="font-mono">INSTALACION_COMPLETADA.md</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
