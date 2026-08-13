import React, { useState } from 'react'

export default function CitationFooter({ citations = [] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!citations || citations.length === 0) return null

  return (
    <div className="mt-3 pt-2.5 border-t border-slate-700/50 text-xs text-slate-400">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 font-semibold text-slate-300 hover:text-cyan-400 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded px-1"
        aria-expanded={isExpanded}
        aria-label="Toggle grounding sources detail"
      >
        <span>🔍</span>
        <span>Based on {citations.length} kitchen intelligence {citations.length === 1 ? 'source' : 'sources'}</span>
        <span className="text-[10px] transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <ul className="mt-2 space-y-1.5 pl-2 border-l-2 border-slate-700">
          {citations.map((cite, idx) => {
            const toolName = cite.tool || cite.capabilityId || 'Kitchen Service'
            const sourceName = cite.source || 'Database'
            const asOfDate = cite.asOf ? new Date(cite.asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
            const summary = cite.summary || null

            return (
              <li key={idx} className="text-[11px] text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-cyan-300">{toolName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({sourceName})</span>
                  {asOfDate && <span className="text-[10px] text-slate-500">• {asOfDate}</span>}
                </div>
                {summary && <p className="text-[10px] text-slate-400 mt-0.5 italic">{summary}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
