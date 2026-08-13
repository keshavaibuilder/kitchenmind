import React, { useState } from 'react'
import TransparencyBadge from './TransparencyBadge.jsx'
import CitationFooter from './CitationFooter.jsx'
import InventoryVisualizer from './visualizers/InventoryVisualizer.jsx'
import RecipeVisualizer from './visualizers/RecipeVisualizer.jsx'
import ShoppingVisualizer from './visualizers/ShoppingVisualizer.jsx'
import PredictionVisualizer from './visualizers/PredictionVisualizer.jsx'
import ActionPreviewCard from './ActionPreviewCard.jsx'
import ActionStatusCard from './ActionStatusCard.jsx'

export default function MessageItem({
  message,
  isStreaming = false,
  onRetry,
  actionState,
  onConfirmAction,
  onCancelAction,
}) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = () => {
    if (message.content && typeof window !== 'undefined' && window.navigator?.clipboard) {
      window.navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Helper to extract tool output data from message citations or payload
  const citations = message.citations || []
  const actionProposalCite = citations.find((c) => c.source === 'action_proposal' && c.proposal)
  const actionProposal = message.actionProposal || message.action_proposal || actionProposalCite?.proposal

  const inventoryCites = citations.filter((c) => c.tool === 'InventoryTool' && c.data?.items)
  const recipeCites = citations.filter((c) => c.tool === 'RecipeTool' && c.data?.recipes)
  const shoppingCites = citations.filter((c) => c.tool === 'ShoppingTool' && c.data?.suggestions)
  const predictionCites = citations.filter((c) => c.tool === 'PredictionTool' && c.data?.predictions)

  const inventoryItems = inventoryCites.flatMap((c) => c.data?.items || [])
  const recipeItems = recipeCites.flatMap((c) => c.data?.recipes || [])
  const shoppingSuggestions = shoppingCites.flatMap((c) => c.data?.suggestions || [])
  const predictions = predictionCites.flatMap((c) => c.data?.predictions || [])

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} my-3 px-2 sm:px-4`}>
      <div
        className={`max-w-full sm:max-w-3xl rounded-2xl p-4 shadow-md transition-all ${
          isUser
            ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white rounded-br-none'
            : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none'
        }`}
      >
        {/* Header row for Assistant message */}
        {!isUser && (
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center text-xs shadow-sm">
                ✨
              </span>
              <span className="font-semibold text-xs text-slate-200">KitchenMind Copilot</span>
            </div>

            <div className="flex items-center gap-1.5">
              <TransparencyBadge
                trustVerdict={message.trust_verdict || 'pass'}
                citations={citations}
              />
              <button
                onClick={handleCopy}
                className="p-1 text-slate-400 hover:text-slate-200 text-xs rounded transition-colors"
                title="Copy message to clipboard"
                aria-label="Copy message"
              >
                {copied ? '✓' : '📋'}
              </button>
            </div>
          </div>
        )}

        {/* Message Content Body */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-100">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
          )}
        </div>

        {/* Rich Tool Visualizers embedded inside assistant message */}
        {!isUser && (
          <>
            {inventoryItems.length > 0 && <InventoryVisualizer items={inventoryItems} />}
            {recipeItems.length > 0 && <RecipeVisualizer recipes={recipeItems} />}
            {shoppingSuggestions.length > 0 && <ShoppingVisualizer suggestions={shoppingSuggestions} />}
            {predictions.length > 0 && <PredictionVisualizer predictions={predictions} />}
          </>
        )}

        {/* Action Proposal & Status Cards */}
        {!isUser && actionProposal && (
          actionState?.status && actionState.status !== 'pending' ? (
            <ActionStatusCard actionState={actionState} proposal={actionProposal} />
          ) : (
            <ActionPreviewCard
              messageId={message.id}
              proposal={actionProposal}
              actionState={actionState}
              onConfirm={onConfirmAction}
              onCancel={onCancelAction}
            />
          )
        )}

        {/* Citations Footer */}
        {!isUser && citations.length > 0 && <CitationFooter citations={citations} />}

        {/* User turn action row */}
        {isUser && onRetry && (
          <div className="mt-2 text-right">
            <button
              onClick={onRetry}
              className="text-[10px] text-cyan-200 hover:text-white underline transition-colors"
              aria-label="Retry message"
            >
              🔄 Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
