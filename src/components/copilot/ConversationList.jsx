import React, { useState } from 'react'

export default function ConversationList({
  conversations = [],
  activeConversationId = null,
  searchQuery = '',
  onSearchChange = () => {},
  onSelectConversation = () => {},
  onNewConversation = () => {},
  onRenameConversation = () => {},
  onDeleteConversation = () => {},
  onClearMessages = () => {},
  onCloseMobileDrawer = () => {},
}) {
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  const handleStartRename = (convo, e) => {
    e.stopPropagation()
    setEditingId(convo.id)
    setEditTitle(convo.title || '')
  }

  const handleSaveRename = (convoId, e) => {
    e.stopPropagation()
    if (editTitle.trim()) {
      onRenameConversation(editTitle.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 border-r border-slate-800 text-slate-100">
      {/* Header & New Chat button */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <span>💬</span> Conversations
          </h3>
          <button
            onClick={onCloseMobileDrawer}
            className="md:hidden text-slate-400 hover:text-white text-xs p-1"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <button
          onClick={() => {
            onNewConversation('New Conversation')
            onCloseMobileDrawer()
          }}
          className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
        >
          <span>✨</span> New Conversation
        </button>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full py-1.5 pl-8 pr-3 bg-slate-800 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">🔍</span>
        </div>
      </div>

      {/* List items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            No conversations found.
          </div>
        ) : (
          conversations.map((convo) => {
            const isActive = convo.id === activeConversationId
            const isEditing = editingId === convo.id
            const title = convo.title || 'Untitled Session'
            const dateStr = convo.updated_at
              ? new Date(convo.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
              : 'Recent'

            return (
              <div
                key={convo.id}
                onClick={() => {
                  onSelectConversation(convo.id)
                  onCloseMobileDrawer()
                }}
                className={`group relative p-2.5 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-between ${
                  isActive
                    ? 'bg-slate-800 border border-cyan-500/40 text-cyan-300 font-semibold shadow-sm'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(convo.id, e)}
                      onBlur={(e) => handleSaveRename(convo.id, e)}
                      autoFocus
                      className="w-full bg-slate-900 border border-cyan-500 text-xs text-white rounded px-1 py-0.5"
                    />
                  ) : (
                    <p className="truncate">{title}</p>
                  )}
                  <span className="text-[10px] text-slate-500 block mt-0.5">{dateStr}</span>
                </div>

                {/* Actions popup on active */}
                {isActive && !isEditing && (
                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                    <button
                      onClick={(e) => handleStartRename(convo, e)}
                      className="p-1 text-slate-400 hover:text-cyan-300 text-[10px]"
                      title="Rename conversation"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (typeof window !== 'undefined' && window.confirm('Clear all messages in this conversation?')) onClearMessages()
                      }}
                      className="p-1 text-slate-400 hover:text-amber-300 text-[10px]"
                      title="Clear messages"
                    >
                      🧹
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (typeof window !== 'undefined' && window.confirm('Delete this conversation?')) onDeleteConversation()
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 text-[10px]"
                      title="Delete conversation"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
