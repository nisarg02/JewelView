export default function ModelInfo({ name, sizeMB, meshCount, vertexCount }) {
  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toString()
  }

  return (
    <div className="absolute top-[72px] left-7 text-xs text-gray-500 leading-relaxed z-20">
      {sizeMB} MB &middot; {meshCount} mesh{meshCount !== 1 ? 'es' : ''} &middot; {fmt(vertexCount)} vertices
    </div>
  )
}
