import * as THREE from 'three'

// Match a mesh material name to a vjson material definition
function findMatch(meshMatName, vjsonMats) {
  if (!meshMatName) return null
  const lower = meshMatName.toLowerCase()

  for (const vjMat of Object.values(vjsonMats)) {
    if (!vjMat.name) continue
    if (vjMat.name === meshMatName) return vjMat
    const vjBase = vjMat.name.split('_0_')[0].toLowerCase()
    const meshBase = meshMatName.split('_0_')[0].toLowerCase()
    if (vjBase === meshBase) return vjMat
    if (lower.includes(vjBase) || vjBase.includes(lower)) return vjMat
  }
  return null
}

// Apply vjson material properties onto a Three.js material
function applyProps(mat, vj) {
  if (vj.color != null) mat.color = new THREE.Color(vj.color)
  if (vj.metalness != null) mat.metalness = vj.metalness
  if (vj.roughness != null) mat.roughness = vj.roughness
  if (vj.envMapIntensity != null) mat.envMapIntensity = vj.envMapIntensity
  if (vj.emissive != null) mat.emissive = new THREE.Color(vj.emissive)
  if (vj.emissiveIntensity != null) mat.emissiveIntensity = vj.emissiveIntensity
  if (vj.clearcoat != null) mat.clearcoat = vj.clearcoat
  if (vj.clearcoatRoughness != null) mat.clearcoatRoughness = vj.clearcoatRoughness
  if (vj.sheen != null) mat.sheen = vj.sheen
  if (vj.sheenColor != null) mat.sheenColor = new THREE.Color(vj.sheenColor)
  if (vj.sheenRoughness != null) mat.sheenRoughness = vj.sheenRoughness
  if (vj.iridescence != null) mat.iridescence = vj.iridescence
  if (vj.iridescenceIOR != null) mat.iridescenceIOR = vj.iridescenceIOR
  if (vj.iridescenceThicknessRange != null) mat.iridescenceThicknessRange = vj.iridescenceThicknessRange
  if (vj.specularIntensity != null) mat.specularIntensity = vj.specularIntensity
  if (vj.specularColor != null) mat.specularColor = new THREE.Color(vj.specularColor)
  if (vj.transmission != null) mat.transmission = vj.transmission
  if (vj.thickness != null) mat.thickness = vj.thickness
  if (vj.reflectivity != null) mat.reflectivity = vj.reflectivity

  const sideMap = { 0: THREE.FrontSide, 1: THREE.BackSide, 2: THREE.DoubleSide }
  if (vj.side != null) mat.side = sideMap[vj.side] ?? THREE.FrontSide

  // Diamond materials
  if (vj.type === 'DiamondMaterial') {
    mat.transmission = 0.95
    mat.thickness = 1.5
    mat.roughness = 0
    mat.metalness = 0
    mat.ior = vj.refractiveIndex ?? 2.42
    mat.specularIntensity = vj.reflectivity ?? 0.5
    mat.envMapIntensity = vj.envMapIntensity ?? 1.3
    mat.clearcoat = 1
    mat.clearcoatRoughness = 0
    if (vj.dispersion != null) mat.dispersion = vj.dispersion
    if (vj.color != null && vj.color !== 16777215) {
      mat.attenuationColor = new THREE.Color(vj.color)
      mat.attenuationDistance = 0.5
    }
  }
}

// Apply vjson material overrides to all meshes in a model
export function applyVjsonMaterials(model, vjsonMats, envIntensity = 1) {
  if (!vjsonMats || Object.keys(vjsonMats).length === 0) return

  model.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    mats.forEach((mat) => {
      const vjMat = findMatch(mat.name, vjsonMats)
      if (vjMat) {
        applyProps(mat, vjMat)
      } else {
        mat.envMapIntensity = envIntensity
      }
      mat.needsUpdate = true
    })
  })
}

// Extract unique material names from a loaded model
export function extractMaterialsFromModel(model) {
  const materials = new Map()
  model.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    mats.forEach((mat) => {
      if (mat.name && !materials.has(mat.name)) {
        materials.set(mat.name, mat)
      }
    })
  })
  return materials
}
