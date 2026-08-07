import useToastStore, { useToast } from '../hooks/useToast'

const TYPE_STYLE = {
  success: 'bg-[#1A7A4A] text-white',
  error: 'bg-[#C0392B] text-white',
  info: 'bg-[#1E3A5F] text-white',
  warning: 'bg-[#E67E22] text-white',
}

/**
 * Mounted once near the app root. Renders whatever useToast().showToast() has queued.
 */
export default function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)
  const { dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`rounded-xl px-4 py-3 shadow-lg text-sm font-semibold flex items-center justify-between gap-3 ${TYPE_STYLE[t.type] || TYPE_STYLE.info}`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="opacity-80 active:opacity-100 flex-shrink-0" aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
