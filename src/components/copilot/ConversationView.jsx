import React, { useState, useEffect, useRef } from 'react'
import MessageItem from './MessageItem.jsx'
import ToolActivityIndicator from './ToolActivityIndicator.jsx'
import ExamplePrompts from './ExamplePrompts.jsx'

export default function ConversationView({
  activeConversation = null,
  messages = [],
  isStreaming = false,
  streamingDelta = '',
  toolCalls = [],
  error = null,
  onSendTurn = () => {},
  onStopGeneration = () => {},
  onRetryLastTurn = () => {},
  onOpenMobileDrawer = () => {},
  actionStates = {},
  onConfirmAction = () => {},
  onCancelAction = () => {},
  initialPrompt = '',
}) {
  const [inputText, setInputText] = useState(initialPrompt || '')
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (initialPrompt) {
      setInputText(initialPrompt)
    }
  }, [initialPrompt])

  // Auto-scroll to bottom on new messages or streaming tokens
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingDelta, toolCalls])

  const handleSend = (e) => {
    e?.preventDefault()
    if (!inputText.trim() || isStreaming) return
    const text = inputText.trim()
    setInputText('')
    onSendTurn(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 relative">
      {/* Top Bar Header */}
      <div className="py-3 px-4 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileDrawer}
            className="md:hidden p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs"
            aria-label="Open conversations sidebar"
          >
            💬 Conversations
          </button>

          <div className="min-w-0">
            <h2 className="font-bold text-sm text-slate-100 truncate">
              {activeConversation?.title || 'KitchenMind Copilot'}
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">
              Grounding AI • Production Certified Runtime
            </p>
          </div>
        </div>

        {/* Top bar right status actions */}
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <button
              onClick={onStopGeneration}
              className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5"
            >
              <span>⏹</span> Stop
            </button>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-semibold">
              ● Ready
            </span>
          )}
        </div>
      </div>

      {/* Main Message Stream Container */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2">
        {messages.length === 0 && !isStreaming ? (
          <ExamplePrompts onSelectPrompt={(prompt) => onSendTurn(prompt)} />
        ) : (
          <>
            {messages.map((msg, idx) => (
              <MessageItem
                key={msg.id || idx}
                message={msg}
                actionState={actionStates ? actionStates[msg.id] : undefined}
                onConfirmAction={onConfirmAction}
                onCancelAction={onCancelAction}
                onRetry={idx === messages.length - 1 && msg.role === 'user' ? onRetryLastTurn : undefined}
              />
            ))}

            {/* Real-time Tool Activity Indicator during execution */}
            {isStreaming && toolCalls.length > 0 && (
              <div className="px-4 max-w-3xl">
                <ToolActivityIndicator toolCalls={toolCalls} />
              </div>
            )}

            {/* Active Streaming Assistant Response Chunk */}
            {isStreaming && streamingDelta && (
              <MessageItem
                message={{
                  role: 'assistant',
                  content: streamingDelta,
                  trust_verdict: 'pass',
                  citations: [],
                }}
                isStreaming={true}
              />
            )}
          </>
        )}

        {/* Error Banner */}
        {error && (
          <div className="my-3 p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-3 shadow-md max-w-3xl mx-auto">
            <div>
              <p className="font-semibold flex items-center gap-1.5">
                <span>⚠️</span> {error.code === 'rate_limited' ? 'Turn Rate Limit Exceeded' : 'Copilot Error'}
              </p>
              <p className="text-[11px] text-rose-300/90 mt-0.5">{error.message}</p>
            </div>
            <button
              onClick={onRetryLastTurn}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-[11px] shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Text Area Input Bar */}
      <div className="p-3 sm:p-4 bg-slate-900/90 backdrop-blur border-t border-slate-800">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-center gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask KitchenMind about recipes, low stock, or predictions..."
            disabled={isStreaming}
            className="flex-1 bg-slate-800 border border-slate-700/80 focus:border-cyan-500 rounded-xl py-3 pl-4 pr-12 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none shadow-inner disabled:opacity-50"
            aria-label="Ask KitchenMind Copilot"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isStreaming}
            className="absolute right-3 p-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white rounded-lg transition-all shadow disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Send message"
          >
            <span>➔</span>
          </button>
        </form>

        <p className="text-[10px] text-center text-slate-500 mt-2">
          KitchenMind Copilot provides informational intelligence grounded in your household database. Read-only AI.
        </p>
      </div>
    </div>
  )
}
