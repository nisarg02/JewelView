import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { loadHDREnvMap } from '../lib/env-loader'
import { applyVjsonMaterials, extractMaterialsFromModel } from '../lib/material-mapper'
import {
  getSceneConfig, getCameraConfig, getControlsConfig,
  getTonemapConfig, getVjsonMaterials,
} from '../lib/vjson-parser'

export default function useThreeScene(containerRef, vjson) {
  const internals = useRef({})
  const [sceneInited, setSceneInited] = useState(false)

  // Init scene
  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xc8c6c2)

    const container = containerRef.current
    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000)
    camera.position.set(0, 3, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Position canvas at top-left of container
    const canvas = renderer.domElement
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'

    container.appendChild(canvas)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.update()

    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.3))
    const dl = new THREE.DirectionalLight(0xffffff, 1.5)
    dl.position.set(5, 10, 5)
    dl.castShadow = true
    dl.shadow.mapSize.set(2048, 2048)
    dl.shadow.bias = -0.0001
    dl.shadow.radius = 4
    scene.add(dl)

    const dlFill = new THREE.DirectionalLight(0xffffff, 0.6)
    dlFill.position.set(-5, 4, -5)
    scene.add(dlFill)

    // Composer
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.25, 0.4, 0.85)
    composer.addPass(bloomPass)

    composer.addPass(new OutputPass())

    // Draco
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    internals.current = { scene, camera, renderer, controls, composer, bloomPass, pmremGenerator, gltfLoader, model: null, floorGroup: null }
    setSceneInited(true)

    // Render loop
    let running = true
    function animate() {
      if (!running) return
      requestAnimationFrame(animate)
      controls.update()
      composer.render()
    }
    animate()

    // Resize — use container dimensions
    function onResize() {
      const w = containerRef.current?.clientWidth || window.innerWidth
      const h = containerRef.current?.clientHeight || window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      composer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // Force an initial resize after a tick (container may not have final size yet)
    requestAnimationFrame(onResize)

    return () => {
      running = false
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [containerRef])

  // Apply vjson config when both scene and vjson are ready
  useEffect(() => {
    if (!vjson || !sceneInited || !internals.current.scene) return
    const { scene, camera, controls, renderer, composer, pmremGenerator } = internals.current

    // Scene
    const sc = getSceneConfig(vjson)
    if (sc.backgroundColor) scene.background = new THREE.Color(sc.backgroundColor.r, sc.backgroundColor.g, sc.backgroundColor.b)
    scene.environmentIntensity = sc.environmentIntensity
    if (sc.environmentRotation) scene.environmentRotation = new THREE.Euler(sc.environmentRotation.x, sc.environmentRotation.y, sc.environmentRotation.z)

    // Camera
    const cam = getCameraConfig(vjson)
    if (cam) {
      camera.fov = cam.fov
      camera.updateProjectionMatrix()
      if (cam.position) camera.position.set(cam.position.x, cam.position.y, cam.position.z)
      if (cam.target) controls.target.set(cam.target.x, cam.target.y, cam.target.z)
    }

    // Controls
    const cc = getControlsConfig(vjson)
    if (cc) {
      Object.assign(controls, cc)
    }
    controls.update()

    // Tonemap
    const tm = getTonemapConfig(vjson)
    if (tm) {
      const tmMap = { 0: THREE.NoToneMapping, 1: THREE.LinearToneMapping, 2: THREE.ReinhardToneMapping, 3: THREE.CineonToneMapping, 4: THREE.ACESFilmicToneMapping, 6: THREE.AgXToneMapping }
      renderer.toneMapping = tmMap[tm.toneMapping] ?? THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = tm.exposure

      composer.passes = []
      composer.addPass(new RenderPass(scene, camera))
      if (internals.current.bloomPass) composer.addPass(internals.current.bloomPass)

      if (tm.saturation !== 1 || tm.contrast !== 1) {
        composer.addPass(new ShaderPass({
          uniforms: {
            tDiffuse: { value: null },
            saturation: { value: tm.saturation },
            contrast: { value: tm.contrast },
          },
          vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `
            uniform sampler2D tDiffuse; uniform float saturation; uniform float contrast; varying vec2 vUv;
            void main() {
              vec4 c = texture2D(tDiffuse, vUv);
              float gray = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
              c.rgb = mix(vec3(gray), c.rgb, saturation);
              c.rgb = (c.rgb - 0.5) * contrast + 0.5;
              gl_FragColor = c;
            }`,
        }))
      }
      composer.addPass(new OutputPass())
    }

  }, [vjson, sceneInited])

  // Load HDR environment maps (independent of vjson)
  useEffect(() => {
    if (!sceneInited || !internals.current.scene) return
    const { scene, pmremGenerator } = internals.current

    loadHDREnvMap('/configs/CUSTOM FOR RING.hdr', pmremGenerator)
      .then((envMap) => {
        scene.environment = envMap
        internals.current.ringEnvMap = envMap
        console.log('Ring HDR env map loaded')
      })
      .catch((err) => console.warn('Ring HDR load failed:', err))

    loadHDREnvMap('/configs/CUSTOM FOR DIAMOND.hdr', pmremGenerator)
      .then((envMap) => {
        internals.current.diamondEnvMap = envMap
        console.log('Diamond HDR env map loaded')
      })
      .catch((err) => console.warn('Diamond HDR load failed:', err))
  }, [sceneInited])

  // Load model — accepts a File object or { url, name, size } for static loading
  const loadModel = useCallback((source, onProgress, onComplete, onError) => {
    const { scene, gltfLoader } = internals.current
    if (!scene) return

    let url, name, sizeMB, ext

    if (source instanceof File) {
      ext = source.name.split('.').pop().toLowerCase()
      url = URL.createObjectURL(source)
      name = source.name.replace(/\.[^/.]+$/, '')
      sizeMB = (source.size / (1024 * 1024)).toFixed(1)
    } else {
      // Static: { url, name, size }
      url = source.url
      name = source.name || 'Model'
      sizeMB = source.size ? (source.size / (1024 * 1024)).toFixed(1) : '?'
      ext = url.split('.').pop().toLowerCase().split('?')[0]
    }

    function handleLoaded(object) {
      // Remove old
      if (internals.current.model) {
        scene.remove(internals.current.model)
        disposeModel(internals.current.model)
      }

      // Center & scale
      const box = new THREE.Box3().setFromObject(object)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 5 / maxDim
      object.scale.setScalar(scale)
      object.position.sub(center.multiplyScalar(scale))

      let meshCount = 0, vertexCount = 0
      object.traverse((child) => {
        if (child.isMesh) {
          meshCount++
          child.castShadow = true
          child.receiveShadow = true
          if (child.geometry) vertexCount += child.geometry.attributes.position?.count || 0
        }
      })

      scene.add(object)
      internals.current.model = object

      const bottomY = center.y - (size.y * scale) / 2;

      if (!internals.current.floorGroup) {
        const floorGroup = new THREE.Group()

        // Soft Shadow plane
        const shadowPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(20, 20),
          new THREE.ShadowMaterial({ opacity: 0.15, depthWrite: false })
        )
        shadowPlane.rotation.x = -Math.PI / 2
        shadowPlane.position.y = 0.001
        shadowPlane.receiveShadow = true
        floorGroup.add(shadowPlane)

        // Subtle Reflector
        const reflector = new Reflector(new THREE.PlaneGeometry(20, 20), {
          clipBias: 0.003,
          textureWidth: window.innerWidth || 1024,
          textureHeight: window.innerHeight || 1024,
          color: 0x444444
        })
        reflector.rotation.x = -Math.PI / 2
        
        // Ensure the reflector is transparent and faint
        reflector.material.transparent = true
        reflector.material.opacity = 0.5
        reflector.material.depthWrite = false
        
        floorGroup.add(reflector)

        internals.current.floorGroup = floorGroup
        scene.add(floorGroup)
      }
      
      internals.current.floorGroup.position.y = bottomY - 0.005;

      // Apply vjson materials
      if (vjson) {
        const vjMats = getVjsonMaterials(vjson)
        const envIntensity = vjson.scene?.environmentIntensity ?? 1
        applyVjsonMaterials(object, vjMats, envIntensity)
      }

      // Apply separate diamond env map to diamond/gem meshes
      const diamondEnv = internals.current.diamondEnvMap
      if (diamondEnv) {
        object.traverse((child) => {
          if (!child.isMesh || !child.material) return
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            // Diamond meshes have transmission > 0 (set by vjson material mapper)
            if (mat.transmission > 0) {
              mat.envMap = diamondEnv
              mat.needsUpdate = true
            }
          })
        })
      }

      // Extract materials from GLB for the selector
      const materialMap = extractMaterialsFromModel(object)
      const materialList = Array.from(materialMap.entries()).map(([matName, mat]) => ({
        name: matName,
        displayName: cleanMaterialName(matName),
        colorHex: '#' + (mat.color?.getHexString?.() || 'aaaaaa'),
        type: mat.type,
      }))

      fitCamera()

      onComplete({ name, sizeMB, meshCount, vertexCount, materials: materialList })
    }

    if (ext === 'glb' || ext === 'gltf') {
      gltfLoader.load(url, (gltf) => handleLoaded(gltf.scene), onProgress, onError)
    } else if (ext === 'obj') {
      import('three/examples/jsm/loaders/OBJLoader.js').then(({ OBJLoader }) => {
        new OBJLoader().load(url, handleLoaded, onProgress, onError)
      })
    } else if (ext === 'fbx') {
      import('three/examples/jsm/loaders/FBXLoader.js').then(({ FBXLoader }) => {
        new FBXLoader().load(url, handleLoaded, onProgress, onError)
      })
    }
  }, [vjson])

  // Switch active material on the model
  const switchMaterial = useCallback((materialName) => {
    const model = internals.current.model
    if (!model) return

    model.traverse((child) => {
      if (!child.isMesh) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      const hasMat = mats.some((m) => m.name === materialName)
      // Show meshes that use this material, hide others
      // Actually - user wants to switch which material variant is rendered
      // So we show all meshes but highlight the selected material
      child.visible = true
    })
  }, [])

  function fitCamera() {
    const { model, camera, controls } = internals.current
    if (!model) return
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    controls.target.copy(center)
    camera.position.set(center.x + maxDim * 0.8, center.y + maxDim * 0.6, center.z + maxDim * 1.5)
    controls.update()
  }

  // Controls API
  const setAutoRotate = useCallback((val) => {
    if (internals.current.controls) internals.current.controls.autoRotate = val
  }, [])

  const setWireframe = useCallback((val) => {
    internals.current.model?.traverse((child) => {
      if (child.isMesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((m) => (m.wireframe = val))
      }
    })
  }, [])

  const resetCamera = useCallback(() => fitCamera(), [])

  const setBackground = useCallback((color) => {
    if (internals.current.scene) internals.current.scene.background = new THREE.Color(color)
  }, [])

  // Apply a specific vjson material variant to the metal meshes
  const applyMaterialVariant = useCallback((materialName) => {
    const model = internals.current.model
    if (!model || !vjson) return

    const vjMats = getVjsonMaterials(vjson)
    // Find the selected vjson material
    let selectedVjMat = null
    for (const vj of Object.values(vjMats)) {
      if (vj.name === materialName) { selectedVjMat = vj; break }
    }
    if (!selectedVjMat) return

    // Apply to all metal meshes (non-diamond, non-ground)
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((mat) => {
        // Only apply to meshes that are metallic
        if (mat.metalness > 0.5) {
          if (selectedVjMat.color != null) mat.color = new THREE.Color(selectedVjMat.color)
          if (selectedVjMat.metalness != null) mat.metalness = selectedVjMat.metalness
          if (selectedVjMat.roughness != null) mat.roughness = selectedVjMat.roughness
          if (selectedVjMat.envMapIntensity != null) mat.envMapIntensity = selectedVjMat.envMapIntensity
          if (selectedVjMat.clearcoat != null) mat.clearcoat = selectedVjMat.clearcoat
          if (selectedVjMat.clearcoatRoughness != null) mat.clearcoatRoughness = selectedVjMat.clearcoatRoughness
          if (selectedVjMat.reflectivity != null) mat.reflectivity = selectedVjMat.reflectivity
          if (selectedVjMat.specularIntensity != null) mat.specularIntensity = selectedVjMat.specularIntensity
          if (selectedVjMat.specularColor != null) mat.specularColor = new THREE.Color(selectedVjMat.specularColor)
          mat.needsUpdate = true
        }
      })
    })
  }, [vjson])

  return { loadModel, resetCamera, setAutoRotate, setWireframe, setBackground, switchMaterial, applyMaterialVariant }
}

function cleanMaterialName(name) {
  // "2_metal_yellowgold_polished_b010c8b353.pmat" -> "Yellow Gold Polished"
  let clean = name.replace(/\.pmat$/, '').replace(/[_\-]/g, ' ')
  // Remove leading numbers and hash suffixes
  clean = clean.replace(/^\d+\s*/, '').replace(/\s+[a-f0-9]{8,}$/i, '')
  // Remove "metal " prefix
  clean = clean.replace(/^metal\s*/i, '')
  // Title case
  clean = clean.replace(/\b\w/g, (c) => c.toUpperCase()).trim()
  return clean || name
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
