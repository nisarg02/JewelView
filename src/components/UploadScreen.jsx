import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

export default function UploadScreen({ onFileSelect }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(files) {
    const file = files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['glb', 'gltf', 'obj', 'fbx'].includes(ext)) {
      alert('Unsupported format. Use: .glb, .gltf, .obj, .fbx')
      return
    }
    onFileSelect(file)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1a1a2e]">
      <div className="text-center max-w-md px-6">
        <Upload className="mx-auto mb-5 text-[var(--gold)]" size={64} strokeWidth={1.5} />
        <h1 className="text-3xl font-semibold tracking-wider text-white mb-2">3D Model Viewer</h1>
        <p className="text-sm text-gray-500 mb-8">Upload a 3D model to get started</p>

        <div
          className={`border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all ${
            dragOver
              ? 'border-[var(--gold)] bg-[var(--gold)]/5'
              : 'border-[var(--gold)]/30 hover:border-[var(--gold)] hover:bg-[var(--gold)]/5'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".glb,.gltf,.obj,.fbx"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-gray-400 text-[15px]">Drag & drop your 3D model here</p>
          <span className="block text-gray-600 text-sm my-3">or</span>
          <button className="px-7 py-2.5 border border-[var(--gold)] rounded-lg bg-[var(--gold)]/15 text-[var(--gold)] text-sm font-medium hover:bg-[var(--gold)]/30 transition-all">
            Browse Files
          </button>
          <p className="mt-4 text-xs text-gray-600">Supports: .glb, .gltf, .obj, .fbx</p>
        </div>
      </div>
    </div>
  )
}
