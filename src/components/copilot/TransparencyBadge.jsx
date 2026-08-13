import React from 'react'

export default function TransparencyBadge({ trustVerdict = 'pass', citations = [], repairCount = 0, isBlocked = false }) {
  const verdict = isBlocked ? 'block' : (trustVerdict || 'pass').toLowerCase()

  const config = {
    pass: {
      bg: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300',
      icon: '🛡️',
      label: 'Grounded in Kitchen Data',
    },
    repair: {
      bg: 'bg-amber-950/60 border-amber-500/40 text-amber-300',
      icon: '⚠️',
      label: 'Repaired for Grounding',
    },
    block: {
      bg: 'bg-rose-950/60 border-rose-500/40 text-rose-300',
      icon: '🚫',
      label: 'Grounded Fallback',
    },
  }[verdict] || {
    bg: 'bg-slate-800 border-slate-700 text-slate-300',
    icon: 'ℹ️',
    label: 'Verified Response',
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium shadow-sm transition-all" tabIndex={0} aria-label={`Grounding status: ${config.label}`}>
      <span className="text-xs">{config.icon}</span>
      <span className={config.bg.split(' ')[2]}>{config.label}</span>
      {citations.length > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-slate-900/80 rounded-full text-slate-400 border border-slate-700/50">
          {citations.length} {citations.length === 1 ? 'source' : 'sources'}
        </span>
      )}
      {repairCount > 0 && (
        <span className="text-[10px] text-amber-400 italic">
          ({repairCount} {repairCount === 1 ? 'repair' : 'repairs'})
        </span>
      )}
    </div>
  )
}
