// Reads the vjson file and returns structured config

export async function loadVjsonConfig(url = '/Ring Master 02-03-2026.vjson') {
  const res = await fetch(url)
  const vjson = await res.json()
  return vjson
}

export function getSceneConfig(vjson) {
  const bg = vjson.scene?.backgroundColor
  const er = vjson.scene?.environmentRotation
  return {
    backgroundColor: bg ? { r: bg.r, g: bg.g, b: bg.b } : null,
    environmentIntensity: vjson.scene?.environmentIntensity ?? 1,
    environmentRotation: er ? { x: er.x || 0, y: er.y || 0, z: er.z || 0 } : null,
  }
}

export function getCameraConfig(vjson) {
  const cam = vjson.scene?.defaultCamera
  if (!cam) return null
  return {
    fov: cam.camOptions?.fov ?? 45,
    position: cam.position ? { x: cam.position.x, y: cam.position.y, z: cam.position.z } : null,
    target: cam.target ? { x: cam.target.x, y: cam.target.y, z: cam.target.z } : null,
  }
}

export function getControlsConfig(vjson) {
  const cc = vjson.scene?.defaultCamera?.camControls
  if (!cc) return null
  return {
    enableDamping: cc.enableDamping ?? true,
    dampingFactor: cc.dampingFactor ?? 0.08,
    autoRotate: cc.autoRotate ?? false,
    autoRotateSpeed: cc.autoRotateSpeed ?? 2,
    enableZoom: cc.enableZoom ?? true,
    zoomSpeed: cc.zoomSpeed ?? 0.15,
    enableRotate: cc.enableRotate ?? true,
    rotateSpeed: cc.rotateSpeed ?? 2,
    enablePan: cc.enablePan ?? true,
    panSpeed: cc.panSpeed ?? 1,
    minDistance: cc.minDistance ?? 0.35,
    maxDistance: cc.maxDistance ?? 1000,
    minPolarAngle: cc.minPolarAngle ?? 0,
    maxPolarAngle: cc.maxPolarAngle ?? Math.PI / 2,
  }
}

export function getTonemapConfig(vjson) {
  const plugin = vjson.plugins?.find(p => p.type === 'Tonemap')
  if (!plugin?.extension) return null
  const tm = plugin.extension
  return {
    toneMapping: tm.toneMapping ?? 4,
    exposure: tm.exposure ?? 1,
    saturation: tm.saturation ?? 1,
    contrast: tm.contrast ?? 1,
  }
}

export function getEnvMapData(vjson) {
  const envRef = vjson.scene?.environment
  if (!envRef?.uuid) return null

  const tex = vjson.resources?.textures?.[envRef.uuid]
  if (!tex?.image) return null

  const imgEntry = vjson.resources?.images?.[tex.image]
  if (!imgEntry?.url) return null

  const dataUrl = typeof imgEntry.url === 'string' ? imgEntry.url : imgEntry.url?.data
  return { dataUrl, name: tex.name }
}

export function getVjsonMaterials(vjson) {
  return vjson.resources?.materials ?? {}
}
