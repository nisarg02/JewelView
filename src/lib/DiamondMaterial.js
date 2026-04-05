import * as THREE from 'three'

/**
 * Custom diamond material with 24-bounce ray tracing.
 * Uses Snell's law refraction + Fresnel reflection + chromatic dispersion
 * to simulate realistic diamond light behavior.
 * Works with equirectangular HDR environment maps.
 */

const RAY_BOUNCES = 24

const diamondVertexShader = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const diamondFragmentShader = `
  uniform sampler2D envMap;
  uniform float envMapIntensity;
  uniform float ior;
  uniform float dispersion;
  uniform float reflectivity;
  uniform float thickness;
  uniform float boostFactor;
  uniform vec3 color;
  uniform float opacity;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec3 vViewDir;

  const int MAX_BOUNCES = ${RAY_BOUNCES};
  const float PI = 3.14159265359;

  // Sample equirectangular env map from a direction
  vec3 sampleEnv(vec3 dir) {
    vec3 d = normalize(dir);
    float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
    float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
    return texture2D(envMap, vec2(u, v)).rgb;
  }

  // Fresnel (Schlick)
  float fresnel(float cosTheta, float f0) {
    return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  }

  // Trace ray through diamond with multiple bounces
  vec3 traceRay(vec3 incidentDir, vec3 normal, float eta) {
    vec3 dir = incidentDir;
    vec3 n = normal;
    vec3 accumulated = vec3(0.0);
    float weight = 1.0;
    bool inside = false;

    for (int i = 0; i < MAX_BOUNCES; i++) {
      float currentEta = inside ? (1.0 / eta) : eta;
      vec3 refracted = refract(dir, n, currentEta);

      if (length(refracted) < 0.001) {
        // Total internal reflection
        dir = reflect(dir, n);
      } else {
        float cosI = abs(dot(dir, n));
        float f0 = pow((eta - 1.0) / (eta + 1.0), 2.0);
        float f = fresnel(cosI, f0);

        // Refracted ray exits — sample environment, offset by thickness
        vec3 exitDir = normalize(refracted * thickness);
        vec3 envColor = sampleEnv(exitDir) * envMapIntensity;
        accumulated += envColor * weight * (1.0 - f);

        // Reflected ray continues inside
        dir = reflect(dir, n);
        weight *= f;
        inside = !inside;
        n = -n;
      }

      if (weight < 0.005) break;
    }

    // Remaining energy exits
    accumulated += sampleEnv(dir) * envMapIntensity * weight;

    return accumulated;
  }

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(vViewDir);
    vec3 incident = -viewDir;

    float eta = 1.0 / ior;

    // Chromatic dispersion — trace R, G, B at slightly different IORs
    float dOffset = dispersion * 0.002;
    float etaR = 1.0 / (ior - dOffset);
    float etaG = eta;
    float etaB = 1.0 / (ior + dOffset);

    vec3 trR = traceRay(incident, normal, 1.0 / etaR);
    vec3 trG = traceRay(incident, normal, 1.0 / etaG);
    vec3 trB = traceRay(incident, normal, 1.0 / etaB);

    vec3 refracted = vec3(trR.r, trG.g, trB.b);

    // Surface reflection
    float cosTheta = max(dot(viewDir, normal), 0.0);
    float f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
    float surfaceF = fresnel(cosTheta, f0);

    vec3 reflDir = reflect(incident, normal);
    vec3 envRefl = sampleEnv(reflDir) * envMapIntensity;

    // Combine refraction + reflection
    vec3 result = mix(refracted, envRefl, surfaceF * reflectivity);

    // Apply tint and boost
    result *= color * boostFactor;

    gl_FragColor = vec4(result, opacity);
  }
`

export function createDiamondMaterial(envMap, options = {}) {
  const {
    color = new THREE.Color(0xffffff),
    ior = 2.42,
    dispersion = 5.0,
    reflectivity = 1.0,
    thickness = 2.0,
    envMapIntensity = 2.0,
    boostFactor = 1.5,
    opacity = 1.0,
  } = options

  return new THREE.ShaderMaterial({
    uniforms: {
      envMap: { value: envMap },
      envMapIntensity: { value: envMapIntensity },
      ior: { value: ior },
      dispersion: { value: dispersion },
      reflectivity: { value: reflectivity },
      thickness: { value: thickness },
      boostFactor: { value: boostFactor },
      color: { value: color },
      opacity: { value: opacity },
    },
    vertexShader: diamondVertexShader,
    fragmentShader: diamondFragmentShader,
    side: THREE.DoubleSide,
    transparent: opacity < 1.0,
  })
}
