import React from 'react'

export default function ToolActivityIndicator({ toolCalls = [] }) {
  if (!toolCalls || toolCalls.length === 0) return null

  return (
    <div className="my-2 p-2.5 bg-slate-900/80 border border-slate-700/60 rounded-lg shadow-sm text-xs text-slate-300 animate-pulse">
      <div className="flex items-center gap-2 mb-1.5 font-semibold text-cyan-400">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span>Executing Copilot Intelligence Capabilities...</span>
      </div>
      <div className="space-y-1 pl-4 border-l border-cyan-800/50">
        {toolCalls.map((tc, idx) => {
          const tool = tc.tool || 'Tool'
          const status = tc.status || 'running'
          const isDone = status === 'success' || status === 'completed'

          return (
            <div key={idx} className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-slate-300">{tool}</span>
              <span className={`font-semibold text-[10px] uppercase tracking-wider ${isDone ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isDone ? '✓ Completed' : '⚡ Executing...'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
