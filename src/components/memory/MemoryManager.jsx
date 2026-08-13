import React, { useState } from 'react'
import { useMemory } from '../../hooks/useMemory.js'
import MemoryCard from './MemoryCard.jsx'

export default function MemoryManager() {
  const {
    memories,
    isLoading,
    saveMemory,
    updateMemory,
    toggleMemoryStatus,
    deleteMemory,
    clearAllMemories,
  } = useMemory()

  const [filterType, setFilterType] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMemory, setEditingMemory] = useState(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Form states for Add / Edit
  const [formKey, setFormKey] = useState('')
  const [formValue, setFormValue] = useState('')
  const [formType, setFormType] = useState('preference')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeMemories = memories.filter((m) => m.status === 'active')
  const disabledMemories = memories.filter((m) => m.status === 'disabled')

  const filteredMemories = memories.filter((m) => {
    if (filterType === 'active') return m.status === 'active'
    if (filterType === 'disabled') return m.status === 'disabled'
    if (filterType !== 'all') return m.memory_type === filterType
    return true
  })

  const openAddModal = () => {
    setFormKey('')
    setFormValue('')
    setFormType('preference')
    setEditingMemory(null)
    setShowAddModal(true)
  }

  const openEditModal = (memory) => {
    setEditingMemory(memory)
    setFormKey(memory.memory_key)
    setFormValue(memory.memory_value)
    setFormType(memory.memory_type)
    setShowAddModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formKey.trim() || !formValue.trim()) return

    setIsSubmitting(true)
    try {
      if (editingMemory) {
        await updateMemory({
          memoryId: editingMemory.id,
          updates: {
            memory_key: formKey.trim().toLowerCase().replace(/\s+/g, '_'),
            memory_value: formValue.trim(),
            memory_type: formType,
          },
        })
      } else {
        await saveMemory({
          memoryKey: formKey.trim().toLowerCase().replace(/\s+/g, '_'),
          memoryValue: formValue.trim(),
          memoryType: formType,
          source: 'ui_setting',
        })
      }
      setShowAddModal(false)
      setEditingMemory(null)
    } catch (err) {
      console.error('[MemoryManager] Failed to save memory:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClearAll = async () => {
    setIsSubmitting(true)
    try {
      await clearAllMemories()
      setShowClearConfirm(false)
    } catch (err) {
      console.error('[MemoryManager] Failed to clear memories:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🧠</span> What KitchenMind Remembers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Explicit long-term memories remembered from your conversation instructions or settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAddModal}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
          >
            <span>+</span> Add Memory
          </button>

          {memories.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors border border-rose-200 dark:border-rose-800"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{activeMemories.length}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Active Memories</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{disabledMemories.length}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Disabled</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
          <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{memories.length}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Stored</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
        {[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'disabled', label: 'Disabled' },
          { key: 'preference', label: 'Preferences' },
          { key: 'restriction', label: 'Restrictions' },
          { key: 'habit', label: 'Habits' },
          { key: 'instruction', label: 'Instructions' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterType(tab.key)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              filterType === tab.key
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Memory List */}
      {isLoading ? (
        <div className="text-center py-12 text-xs text-slate-400">Loading household memories...</div>
      ) : filteredMemories.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-2xl mb-2">🧠</div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No memories found</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            You can ask the Copilot in conversation ("Remember that we prefer quick breakfasts") or click "+ Add Memory" above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMemories.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              onToggleStatus={(id, status) => toggleMemoryStatus({ memoryId: id, status })}
              onEdit={openEditModal}
              onDelete={(id) => deleteMemory(id)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingMemory ? 'Edit Memory' : 'Add Explicit Memory'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Memory Topic / Key (e.g. weekday_breakfast)
                </label>
                <input
                  type="text"
                  required
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="weekday_breakfast"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Memory Value / Instruction
                </label>
                <textarea
                  required
                  rows={3}
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="Prefers quick 15-minute breakfasts on weekdays."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="preference">Preference</option>
                  <option value="restriction">Restriction</option>
                  <option value="habit">Habit</option>
                  <option value="instruction">Instruction</option>
                  <option value="context">Context</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Saving...' : editingMemory ? 'Update Memory' : 'Save Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-3xl mb-2">⚠️</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Clear All Copilot Memories?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              This will remove all long-term memories for your household. KitchenMind will no longer consider them when generating meal suggestions.
            </p>

            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {isSubmitting ? 'Clearing...' : 'Clear All Memories'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
