import { RotateCcw, RefreshCw, Box, Maximize, Plus } from 'lucide-react'
import { cn } from '../lib/cn'

export default function ViewerControls({
  onReset,
  onToggleAutoRotate,
  autoRotate,
  onToggleWireframe,
  wireframe,
  onFullscreen,
  onNewModel,
}) {
  return (
    <div className="absolute top-6 right-6 flex gap-2 pointer-events-auto z-20">
      <ControlBtn title="Reset Camera" onClick={onReset}>
        <RotateCcw size={18} />
      </ControlBtn>
      <ControlBtn title="Auto-Rotate" onClick={onToggleAutoRotate} active={autoRotate}>
        <RefreshCw size={18} />
      </ControlBtn>
      <ControlBtn title="Wireframe" onClick={onToggleWireframe} active={wireframe}>
        <Box size={18} />
      </ControlBtn>
      <ControlBtn title="Fullscreen" onClick={onFullscreen}>
        <Maximize size={18} />
      </ControlBtn>
      <ControlBtn title="Load New Model" onClick={onNewModel}>
        <Plus size={18} />
      </ControlBtn>
    </div>
  )
}

function ControlBtn({ children, title, onClick, active }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'w-10 h-10 rounded-lg border flex items-center justify-center cursor-pointer transition-all backdrop-blur-md',
        active
          ? 'bg-[var(--gold)]/30 border-[var(--gold)] text-[var(--gold)]'
          : 'bg-black/40 border-white/15 text-gray-400 hover:bg-[var(--gold)]/20 hover:border-[var(--gold)] hover:text-[var(--gold)]'
      )}
    >
      {children}
    </button>
  )
}
