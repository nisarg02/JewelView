import { useEffect, useRef, useState } from 'react'
import useThreeScene from '../hooks/useThreeScene'

export default function ThreeViewer() {
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)
  
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hasModel, setHasModel] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Initialize the unified rendering engine
  const { loadModel } = useThreeScene(containerRef, null)

  // ── Drag & Drop ──
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onDragOver(e) { e.preventDefault(); setDragOver(true) }
    function onDragLeave() { setDragOver(false) }
    function onDrop(e) {
      e.preventDefault()
      setDragOver(false)
      handleFileInput(e.dataTransfer?.files?.[0])
    }

    container.addEventListener('dragover', onDragOver)
    container.addEventListener('dragleave', onDragLeave)
    container.addEventListener('drop', onDrop)

    return () => {
      container.removeEventListener('dragover', onDragOver)
      container.removeEventListener('dragleave', onDragLeave)
      container.removeEventListener('drop', onDrop)
    }
  }, [])

  // ── File Handling ──
  function handleFileInput(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'glb' || ext === 'gltf') {
      loadGLB(file)
    }
  }

  function loadGLB(file) {
    setLoading(true)
    setProgress(0)
    
    loadModel(
      file,
      (p) => { 
        if (p.total > 0) setProgress(Math.round((p.loaded / p.total) * 100)) 
      },
      (res) => { 
        console.log("Model loaded successfully:", res)
        setLoading(false)
        setHasModel(true)
      },
      (err) => { 
        console.error('GLB load error:', err)
        setLoading(false) 
      }
    )
  }

  const onBrowse = () => fileInputRef.current?.click()
  const onFileChange = (e) => {
    handleFileInput(e.target.files?.[0])
    e.target.value = ''
  }

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#e8e8e8' }}>
      <input ref={fileInputRef} type="file" accept=".glb,.gltf" onChange={onFileChange} style={{ display: 'none' }} />

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0f0f13]">
          <div className="text-center">
            <div className="w-10 h-10 border-[3px] border-white/10 border-t-[#c9a84c] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/40 text-sm">
              {progress > 0 ? `Loading model... ${progress}%` : 'Preparing environment...'}
            </p>
          </div>
        </div>
      )}

      {/* Upload screen — SaaS-style landing */}
      {!loading && !hasModel && (
        <div className="absolute inset-0 z-[15] flex flex-col bg-[#0f0f13]">
          {/* Header */}
          <header className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c9a84c] to-[#a07d2e] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-[15px] font-semibold text-white tracking-wide">JewelView</span>
              <span className="text-[11px] text-white/30 font-medium bg-white/[0.06] px-2 py-0.5 rounded-full ml-1">3D</span>
            </div>
            <div />
          </header>

          {/* Main content */}
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center max-w-lg w-full">
              {/* Icon */}
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#c9a84c]/20 to-[#c9a84c]/5 border border-[#c9a84c]/10 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>

              <h1 className="text-[28px] font-bold text-white mb-2 tracking-tight">
                3D Jewelry Viewer
              </h1>
              <p className="text-[15px] text-white/40 mb-10 leading-relaxed">
                Upload your .glb model for realistic rendering with<br />
                diamond refraction, metallic reflections & HDR lighting
              </p>

              {/* Drop zone */}
              <div
                onClick={onBrowse}
                className={`
                  relative group rounded-2xl p-10 cursor-pointer transition-all duration-300
                  border-2 border-dashed
                  ${dragOver
                    ? 'border-[#c9a84c] bg-[#c9a84c]/[0.04]'
                    : 'border-white/[0.08] hover:border-[#c9a84c]/40 hover:bg-white/[0.02]'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center transition-all
                    ${dragOver ? 'bg-[#c9a84c]/20' : 'bg-white/[0.04] group-hover:bg-white/[0.06]'}
                  `}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke={dragOver ? '#c9a84c' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5"
                      className="transition-colors group-hover:stroke-white/50">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>

                  <div>
                    <p className="text-[14px] text-white/50 mb-1">
                      Drag & drop your 3D model here
                    </p>
                    <p className="text-[12px] text-white/20">
                      .glb and .gltf files supported
                    </p>
                  </div>

                  <div className="flex items-center gap-3 mt-1">
                    <span className="h-px w-8 bg-white/[0.06]" />
                    <span className="text-[11px] text-white/20 uppercase tracking-widest">or</span>
                    <span className="h-px w-8 bg-white/[0.06]" />
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); onBrowse() }}
                    className="px-6 py-2.5 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0f0f13] text-[13px] font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-[#c9a84c]/20"
                  >
                    Browse Files
                  </button>
                </div>
              </div>

              {/* Features */}
              <div className="flex items-center justify-center gap-6 mt-10">
                {[
                  { icon: '◇', label: 'Diamond Refraction' },
                  { icon: '✦', label: 'HDR Lighting' },
                  { icon: '◎', label: '24-Bounce Ray Trace' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-white/20">
                    <span className="text-[#c9a84c]/60 text-sm">{f.icon}</span>
                    <span className="text-[11px] tracking-wide">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <footer className="h-6" />
        </div>
      )}

      {/* Viewer toolbar when model is loaded */}
      {!loading && hasModel && (
        <>
          {/* Change model button — goes back to upload screen */}
          <button
            onClick={() => setHasModel(false)}
            className="absolute top-5 right-5 z-10 flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white/60 text-[13px] hover:bg-black/60 hover:text-white/90 hover:border-white/20 transition-all cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Change Model
          </button>

          {/* Bottom hint */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-black/25 z-5 whitespace-nowrap">
            Drag to rotate &middot; Scroll to zoom &middot; Right-click to pan
          </p>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .animate-spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  )
}
