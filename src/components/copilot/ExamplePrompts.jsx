import React from 'react'

const PROMPTS = [
  { emoji: '🥘', text: 'What should I cook tonight?' },
  { emoji: '📦', text: 'What ingredients are running low?' },
  { emoji: '🛒', text: 'What should I buy this weekend?' },
  { emoji: '⏳', text: 'Which vegetables will expire first?' },
  { emoji: '🧾', text: 'Why did my grocery bill increase?' },
  { emoji: '🍅', text: 'Show recipes using tomatoes.' },
]

export default function ExamplePrompts({ onSelectPrompt }) {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto text-center">
      <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20 animate-bounce">
        <span className="text-3xl">✨</span>
      </div>

      <h2 className="text-xl font-bold text-slate-100 mb-2">KitchenMind AI Copilot</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
        Ask natural questions about your kitchen, pantry stock, depletion forecasts, meal suggestions, or recipes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
        {PROMPTS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(p.text)}
            className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/50 rounded-xl transition-all group flex items-center gap-3 shadow-sm hover:shadow-cyan-950/30"
          >
            <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">{p.emoji}</span>
            <span className="text-xs font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">
              {p.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
