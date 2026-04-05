import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { createDiamondMaterial } from '../lib/DiamondMaterial'

const RING_HDR = '/configs/CUSTOM FOR RING.hdr'
const DIAMOND_HDR = '/configs/CUSTOM FOR DIAMOND.hdr'
const METAL_PMAT = '/configs/Metal-material.pmat'
const DIAMOND_DMAT = '/configs/diamond-material.dmat'

export default function ThreeViewer() {
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)
  const sceneRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [hasModel, setHasModel] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // ── Scene ──
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xe8e8e8)

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(25, container.clientWidth / container.clientHeight, 0.01, 1000)
    camera.position.set(0, 3, 8)

    // ── Renderer (realistic settings) ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Physically correct lighting
    renderer.useLegacyLights = false

    // Tone mapping for realistic HDR → LDR conversion
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    // Output encoding
    renderer.outputColorSpace = THREE.SRGBColorSpace

    // Shadows
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const canvas = renderer.domElement
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    container.appendChild(canvas)

    // ── Controls ──
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.rotateSpeed = 1
    controls.zoomSpeed = 0.5
    controls.panSpeed = 0.5
    controls.minDistance = 1
    controls.maxDistance = 50
    controls.autoRotate = true
    controls.autoRotateSpeed = 1.5
    controls.update()

    // ── PMREM for env maps ──
    const pmrem = new THREE.PMREMGenerator(renderer)
    pmrem.compileEquirectangularShader()

    // ── Lights ──
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(5, 8, 5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xffffff, 0.6)
    fill.position.set(-5, 4, -3)
    scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffffff, 0.3)
    rim.position.set(0, -2, -5)
    scene.add(rim)

    // ── Store refs ──
    sceneRef.current = { scene, camera, renderer, controls, pmrem, model: null, diamondEnv: null, pmatConfig: null, dmatConfig: null }

    // ── Loaders ──
    const hdrLoader = new HDRLoader()
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    // ── Load HDRs + material configs, then ready ──
    const ringHdrP = new Promise((resolve) => {
      hdrLoader.load(RING_HDR, (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping
        const envMap = pmrem.fromEquirectangular(tex).texture
        scene.environment = envMap
        tex.dispose()
        resolve()
      })
    })

    const diamondHdrP = new Promise((resolve) => {
      hdrLoader.load(DIAMOND_HDR, (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping
        sceneRef.current.diamondEnv = tex
        resolve()
      })
    })

    const pmatP = fetch(METAL_PMAT).then(r => r.json()).then(data => {
      sceneRef.current.pmatConfig = data
    }).catch(() => console.warn('PMAT config not found'))

    const dmatP = fetch(DIAMOND_DMAT).then(r => r.json()).then(data => {
      sceneRef.current.dmatConfig = data
    }).catch(() => console.warn('DMAT config not found'))

    Promise.all([ringHdrP, diamondHdrP, pmatP, dmatP]).then(() => {
      console.log('HDRs + material configs loaded')
      setLoading(false)
    })

    // ── Render loop ──
    let running = true
    function animate() {
      if (!running) return
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ──
    function onResize() {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // ── Drag & Drop ──
    function onDragOver(e) { e.preventDefault(); setDragOver(true) }
    function onDragLeave() { setDragOver(false) }
    function onDrop(e) {
      e.preventDefault()
      setDragOver(false)
      handleFileInput(e.dataTransfer?.files?.[0])
    }
    function handleFileInput(file) {
      if (!file) return
      const ext = file.name.split('.').pop().toLowerCase()
      if (ext === 'glb' || ext === 'gltf') {
        const url = URL.createObjectURL(file)
        loadGLB(gltfLoader, url)
      }
    }
    // Store handleFileInput so the browse button can use it
    sceneRef.current.handleFileInput = handleFileInput

    container.addEventListener('dragover', onDragOver)
    container.addEventListener('dragleave', onDragLeave)
    container.addEventListener('drop', onDrop)

    // ── Load GLB helper ──
    function loadGLB(loader, url) {
      setLoading(true)
      setProgress(0)
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene

          // Remove old model
          if (sceneRef.current.model) {
            scene.remove(sceneRef.current.model)
            disposeModel(sceneRef.current.model)
          }

          // Center & scale
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 4 / maxDim
          model.scale.setScalar(scale)
          model.position.sub(center.multiplyScalar(scale))

          // Apply materials based on mesh/geometry name
          const pmat = sceneRef.current.pmatConfig
          const dmat = sceneRef.current.dmatConfig
          const dEnv = sceneRef.current.diamondEnv

          model.traverse((child) => {
            if (!child.isMesh) return
            child.castShadow = true
            child.receiveShadow = true

            const meshName = (child.name || '').toLowerCase()
            const matName = (child.material?.name || '').toLowerCase()
            const isGem = meshName.startsWith('gem') || matName.includes('gem') ||
              matName.includes('diamond') || matName.includes('stone') || matName.includes('crystal')
            const isMetal = meshName.startsWith('metal') || matName.includes('metal')

            const mats = Array.isArray(child.material) ? child.material : [child.material]
            const newMats = mats.map((mat) => {
              if (isGem) {
                // Diamond config from scene.glb: dispersion 5.0, transmission 1.0, IOR 2.333
                const boost = dmat?.boostFactors || { x: 1, y: 1, z: 1 }
                const avgBoost = dmat ? (boost.x + boost.y + boost.z) / 3 : 1.5
                const diamondMat = createDiamondMaterial(dEnv, {
                  color: new THREE.Color(dmat?.color ?? 0xffffff),
                  ior: 2.333,
                  dispersion: 5.0,
                  reflectivity: dmat?.reflectivity ?? 0.2,
                  thickness: 1.0,
                  envMapIntensity: dmat?.envMapIntensity ?? 0.6,
                  boostFactor: avgBoost,
                  opacity: 1.0,
                })
                mat.dispose()
                return diamondMat
              } else if ((isMetal || mat.metalness > 0.3) && pmat) {
                // Apply PMAT config to metal
                mat.color = new THREE.Color(pmat.color ?? mat.color)
                mat.metalness = pmat.metalness ?? 1
                mat.roughness = pmat.roughness ?? 0
                mat.envMapIntensity = pmat.envMapIntensity ?? 0.8
                mat.reflectivity = pmat.reflectivity ?? 1.4
                mat.clearcoat = pmat.clearcoat ?? 1
                mat.clearcoatRoughness = pmat.clearcoatRoughness ?? 0.23
                mat.specularIntensity = pmat.specularIntensity ?? 1
                mat.specularColor = new THREE.Color(pmat.specularColor ?? 0xffffff)
                mat.sheen = pmat.sheen ?? 0
                mat.sheenColor = new THREE.Color(pmat.sheenColor ?? 0)
                mat.sheenRoughness = pmat.sheenRoughness ?? 1
                mat.iridescence = pmat.iridescence ?? 0
                mat.iridescenceIOR = pmat.iridescenceIOR ?? 1.3
                mat.anisotropy = pmat.anisotropy ?? 0
                mat.anisotropyRotation = pmat.anisotropyRotation ?? 0
                mat.emissive = new THREE.Color(pmat.emissive ?? 0)
                mat.emissiveIntensity = pmat.emissiveIntensity ?? 0
                mat.transmission = pmat.transmission ?? 0
                mat.side = pmat.side === 2 ? THREE.DoubleSide : pmat.side === 1 ? THREE.BackSide : THREE.FrontSide
                mat.needsUpdate = true
                return mat
              } else {
                // Fallback metal without pmat
                mat.envMapIntensity = 1.2
                mat.needsUpdate = true
                return mat
              }
            })

            child.material = newMats.length === 1 ? newMats[0] : newMats
          })

          scene.add(model)
          sceneRef.current.model = model

          // Apply diamond env if already loaded
          if (sceneRef.current.diamondEnv) {
            applyDiamondEnv(model, sceneRef.current.diamondEnv)
          }

          // Fit camera
          const newBox = new THREE.Box3().setFromObject(model)
          const newCenter = newBox.getCenter(new THREE.Vector3())
          const newSize = newBox.getSize(new THREE.Vector3())
          const maxNew = Math.max(newSize.x, newSize.y, newSize.z)
          controls.target.copy(newCenter)
          camera.position.set(newCenter.x, newCenter.y + maxNew * 0.3, newCenter.z + maxNew * 2)
          controls.update()

          setLoading(false)
          setHasModel(true)
        },
        (p) => { if (p.total > 0) setProgress(Math.round((p.loaded / p.total) * 100)) },
        (err) => { console.error('GLB load error:', err); setLoading(false) }
      )
    }

    return () => {
      running = false
      window.removeEventListener('resize', onResize)
      container.removeEventListener('dragover', onDragOver)
      container.removeEventListener('dragleave', onDragLeave)
      container.removeEventListener('drop', onDrop)
      renderer.dispose()
      container.removeChild(canvas)
    }
  }, [])

  const onBrowse = () => fileInputRef.current?.click()
  const onFileChange = (e) => {
    sceneRef.current?.handleFileInput?.(e.target.files?.[0])
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

function applyDiamondEnv(model, envMap) {
  model.traverse((child) => {
    if (!child.isMesh) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    mats.forEach((mat) => {
      if (mat.isShaderMaterial && mat.uniforms?.envMap) {
        // Custom diamond shader
        mat.uniforms.envMap.value = envMap
      } else if (mat.transmission > 0) {
        // MeshPhysicalMaterial fallback
        mat.envMap = envMap
        mat.envMapIntensity = 2.5
        mat.needsUpdate = true
      }
    })
  })
}

function disposeModel(model) {
  model.traverse((child) => {
    if (!child.isMesh) return
    child.geometry?.dispose()
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    mats.forEach((m) => {
      for (const k in m) {
        const v = m[k]
        if (v && typeof v === 'object' && typeof v.dispose === 'function') v.dispose()
      }
      m.dispose()
    })
  })
}
