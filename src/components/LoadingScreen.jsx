export default function LoadingScreen({ progress, message }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a1a2e]">
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-white/10 border-t-[var(--gold)] rounded-full animate-spin mx-auto mb-5" />
        <p className="text-sm text-gray-400">{message || 'Loading 3D Model...'}</p>
        <div className="w-[200px] h-1 bg-white/10 rounded-full mt-3 mx-auto overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-light)] rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">{progress}%</p>
      </div>
    </div>
  )
}
