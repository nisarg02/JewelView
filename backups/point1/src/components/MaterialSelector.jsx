import { cn } from '../lib/cn'

export default function MaterialSelector({ materials, activeMaterial, onSelect }) {
  if (!materials || materials.length <= 1) return null

  return (
    <div className="absolute bottom-24 left-7 pointer-events-auto z-20">
      <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Material</label>
      <div className="flex flex-wrap gap-2 max-w-xs">
        {materials.map((mat) => (
          <button
            key={mat.name}
            onClick={() => onSelect(mat.name)}
            title={mat.name}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all backdrop-blur-md',
              activeMaterial === mat.name
                ? 'bg-[var(--gold)]/30 border-[var(--gold)] text-[var(--gold)]'
                : 'bg-black/40 border-white/15 text-gray-400 hover:border-[var(--gold)] hover:text-[var(--gold)]'
            )}
          >
            <span
              className="w-3 h-3 rounded-full border border-white/20 shrink-0"
              style={{ backgroundColor: mat.colorHex }}
            />
            <span className="truncate max-w-[120px]">{mat.displayName}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
