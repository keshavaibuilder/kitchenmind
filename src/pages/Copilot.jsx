import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import useCopilot from '../hooks/useCopilot'
import ConversationList from '../components/copilot/ConversationList.jsx'
import ConversationView from '../components/copilot/ConversationView.jsx'
import MemoryManager from '../components/memory/MemoryManager.jsx'

export default function Copilot() {
  const location = useLocation()
  const initialPrompt = location.state?.initialPrompt || ''
  const queryClient = useQueryClient()
  const {
    conversations,
    activeConversation,
    activeConversationId,
    messages,
    isLoadingConversations,
    isStreaming,
    streamingDelta,
    toolCalls,
    error,
    searchQuery,
    setSearchQuery,
    selectConversation,
    createNewConversation,
    sendTurn,
    stopGeneration,
    retryLastTurn,
    renameActiveConversation,
    deleteActiveConversation,
    clearActiveMessages,
    actionStates,
    confirmAction,
    cancelAction,
  } = useCopilot()

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'memory'

  const handleConfirmAction = (messageId, proposal) => {
    return confirmAction(messageId, proposal, queryClient)
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-950 font-sans overflow-hidden">
      {/* Top Bar Mode Selector */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>💬</span> Copilot Chat
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('memory')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'memory'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🧠</span> What KitchenMind Remembers
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeTab === 'chat' ? (
          <>
            {/* Desktop Sidebar */}
            <div className="hidden md:block w-72 lg:w-80 shrink-0 h-full">
              <ConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelectConversation={selectConversation}
                onNewConversation={createNewConversation}
                onRenameConversation={renameActiveConversation}
                onDeleteConversation={deleteActiveConversation}
                onClearMessages={clearActiveMessages}
              />
            </div>

            {/* Mobile Drawer Overlay */}
            {isMobileDrawerOpen && (
              <div className="md:hidden fixed inset-0 z-50 flex">
                <div
                  className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
                  onClick={() => setIsMobileDrawerOpen(false)}
                />
                <div className="relative w-4/5 max-w-sm h-full z-10 shadow-2xl">
                  <ConversationList
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onSelectConversation={selectConversation}
                    onNewConversation={createNewConversation}
                    onRenameConversation={renameActiveConversation}
                    onDeleteConversation={deleteActiveConversation}
                    onClearMessages={clearActiveMessages}
                    onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
                  />
                </div>
              </div>
            )}

            {/* Main Conversation View Area */}
            <div className="flex-1 h-full min-w-0">
              <ConversationView
                activeConversation={activeConversation}
                messages={messages}
                isStreaming={isStreaming}
                streamingDelta={streamingDelta}
                toolCalls={toolCalls}
                error={error}
                onSendTurn={sendTurn}
                onStopGeneration={stopGeneration}
                onRetryLastTurn={retryLastTurn}
                onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
                actionStates={actionStates}
                onConfirmAction={handleConfirmAction}
                onCancelAction={cancelAction}
                initialPrompt={initialPrompt}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 h-full overflow-y-auto bg-white dark:bg-slate-950">
            <MemoryManager />
          </div>
        )}
      </div>
    </div>
  )
}
