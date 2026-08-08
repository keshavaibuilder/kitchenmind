import { useNavigate } from 'react-router-dom'

export default function QuickActionsBar({ actions }) {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => navigate(action.path)}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left active:scale-95 transition-transform"
        >
          <div className="text-2xl mb-2" aria-hidden="true">
            {action.emoji}
          </div>
          <p className="text-xs font-semibold text-[#1E3A5F]">{action.label}</p>
        </button>
      ))}
    </div>
  )
}
