# JewelView - 3D Jewelry Viewer

A browser-based 3D jewelry viewer with realistic rendering — diamond refraction with 24-bounce ray tracing, metallic reflections, and HDR environment lighting.

## Features

- **24-Bounce Ray-Traced Diamonds** — Custom GLSL shader simulating real diamond optics with Snell's law refraction, Fresnel reflection, and chromatic dispersion (IOR 2.42)
- **HDR Environment Mapping** — Separate HDR environment maps for metals and diamonds
- **Physically-Based Metals** — Full PBR materials with clearcoat, reflectivity, and environment reflections
- **Drag & Drop Upload** — Drop a `.glb` or `.gltf` file to view any 3D jewelry model
- **Auto-Rotate** — Smooth orbital camera with damping
- **Responsive** — Full viewport rendering at native resolution

## Tech Stack

- **Three.js** — WebGL rendering engine
- **React** — UI framework
- **Vite** — Build tool & dev server
- **Tailwind CSS** — Styling
- **Custom GLSL Shaders** — Diamond ray tracing

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## How It Works

### Diamond Rendering
The diamond material uses a custom fragment shader that traces rays through the gem geometry with 24 internal bounces. Each bounce applies:
- **Snell's Law** for refraction at IOR 2.42 (real diamond)
- **Fresnel equations** (Schlick approximation) for reflect/refract ratio
- **Total internal reflection** when angle exceeds critical angle
- **Chromatic dispersion** — R/G/B traced at slightly different IORs for rainbow fire

### Metal Rendering
Metals use Three.js `MeshPhysicalMaterial` with:
- `metalness: 1.0`, `roughness: 0`
- `clearcoat: 1.0` for polished surface
- `envMapIntensity: 1.18` matched to HDR environment
- `reflectivity: 1.0` for mirror-like reflections

### Environment
Two separate HDR environment maps:
- **Ring HDR** — Scene environment for metal reflections
- **Diamond HDR** — Per-material env map for gem sparkle

## Project Structure

```
src/
  components/
    ThreeViewer.jsx     # Main viewer (scene, camera, controls, model loading)
  lib/
    DiamondMaterial.js  # Custom 24-bounce ray-tracing diamond shader
    env-loader.js       # HDR environment map loader
    material-mapper.js  # VJSON material property mapper
    vjson-parser.js     # VJSON scene config parser
public/
    *.hdr               # HDR environment maps
    *.glb               # 3D model files
    *.vjson             # Scene configuration
```

## License

MIT License - see [LICENSE](LICENSE) for details.
