import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

export function loadHDREnvMap(url, pmremGenerator) {
  return new Promise((resolve, reject) => {
    new HDRLoader().load(
      url,
      (hdrTexture) => {
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping
        const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture
        hdrTexture.dispose()
        resolve(envMap)
      },
      undefined,
      (err) => reject(err)
    )
  })
}
