import { useState, useEffect, useCallback, useRef } from 'react'
import { CopilotService } from '../services/CopilotService.js'
import { useHousehold } from './useHousehold.js'

export default function useCopilot() {
  const { household } = useHousehold()
  const householdId = household?.id

  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingDelta, setStreamingDelta] = useState('')
  const [toolCalls, setToolCalls] = useState([])
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const abortControllerRef = useRef(null)

  // Load conversation list when householdId changes
  const fetchConversations = useCallback(async () => {
    if (!householdId) {
      setConversations([])
      setIsLoadingConversations(false)
      return
    }
    setIsLoadingConversations(true)
    const list = await CopilotService.loadConversations(householdId)
    setConversations(list)
    setIsLoadingConversations(false)
  }, [householdId])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Load messages when activeConversationId changes
  const fetchMessages = useCallback(async (convoId) => {
    if (!convoId) {
      setMessages([])
      return
    }
    setIsLoadingMessages(true)
    const history = await CopilotService.loadMessages(convoId)
    setMessages(history)
    setIsLoadingMessages(false)
  }, [])

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId)
    } else {
      setMessages([])
    }
  }, [activeConversationId, fetchMessages])

  // Select a conversation
  const selectConversation = useCallback((convoId) => {
    if (isStreaming) return
    setActiveConversationId(convoId)
    setError(null)
  }, [isStreaming])

  // Start a new conversation
  const createNewConversation = useCallback(async (initialTitle = 'New Conversation') => {
    if (!householdId || isStreaming) return null
    const newConvo = await CopilotService.createConversation(householdId, initialTitle)
    if (newConvo) {
      setConversations((prev) => [newConvo, ...prev])
      setActiveConversationId(newConvo.id)
      setMessages([])
      setError(null)
    }
    return newConvo
  }, [householdId, isStreaming])

  // Send a user prompt
  const sendTurn = useCallback(async (userPrompt) => {
    if (!userPrompt || typeof userPrompt !== 'string' || isStreaming) return

    const trimmedPrompt = userPrompt.trim()
    if (!trimmedPrompt) return

    setError(null)

    // Ensure we have a conversation ID, or create one if starting fresh
    let currentConvoId = activeConversationId
    if (!currentConvoId) {
      const title = CopilotService.generateAutoTitle(trimmedPrompt)
      const created = await CopilotService.createConversation(householdId, title)
      if (!created) {
        setError({ code: 'convo_create_failed', message: 'Could not create conversation session' })
        return
      }
      currentConvoId = created.id
      setActiveConversationId(created.id)
      setConversations((prev) => [created, ...prev])
    }

    // Optimistically push user message
    const tempUserMsg = {
      id: `temp-user-${Date.now()}`,
      conversation_id: currentConvoId,
      role: 'user',
      content: trimmedPrompt,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    setIsStreaming(true)
    setStreamingDelta('')
    setToolCalls([])

    const ControllerClass = typeof window !== 'undefined' ? window.AbortController : globalThis.AbortController
    const controller = new ControllerClass()
    abortControllerRef.current = controller

    await CopilotService.streamChatTurn({
      message: trimmedPrompt,
      conversationId: currentConvoId,
      signal: controller.signal,
      onToken: (token) => {
        setStreamingDelta((prev) => prev + token)
      },
      onToolCall: (toolCallEv) => {
        setToolCalls((prev) => {
          const idx = prev.findIndex((tc) => tc.tool === toolCallEv.tool)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], ...toolCallEv }
            return updated
          }
          return [...prev, toolCallEv]
        })
      },
      onDone: async (doneMeta) => {
        setIsStreaming(false)
        setStreamingDelta('')
        setToolCalls([])
        abortControllerRef.current = null

        // Re-fetch database messages to get canonical persisted IDs, citations, & trust verdicts
        const targetConvoId = doneMeta.conversationId || currentConvoId
        if (targetConvoId) {
          const updatedHistory = await CopilotService.loadMessages(targetConvoId)
          setMessages(updatedHistory)
        }
        fetchConversations()
      },
      onError: async (errEv) => {
        setIsStreaming(false)
        abortControllerRef.current = null

        if (errEv.code === 'cancelled') {
          // Add partial text as user-cancelled turn if we have streaming delta
          if (streamingDelta) {
            setMessages((prev) => [
              ...prev,
              {
                id: `cancelled-${Date.now()}`,
                conversation_id: currentConvoId,
                role: 'assistant',
                content: streamingDelta + ' *(Generation stopped by user)*',
                created_at: new Date().toISOString(),
              },
            ])
          }
        } else {
          setError(errEv)
        }
        fetchConversations()
      },
    })
  }, [activeConversationId, fetchConversations, householdId, isStreaming, streamingDelta])

  // Stop active generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // Retry last turn
  const retryLastTurn = useCallback(() => {
    if (isStreaming || messages.length === 0) return
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg?.content) {
      sendTurn(lastUserMsg.content)
    }
  }, [isStreaming, messages, sendTurn])

  // Rename active conversation
  const renameActiveConversation = useCallback(async (newTitle) => {
    if (!activeConversationId || !newTitle) return
    const ok = await CopilotService.renameConversation(activeConversationId, newTitle)
    if (ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, title: newTitle.trim() } : c))
      )
    }
  }, [activeConversationId])

  // Delete active conversation
  const deleteActiveConversation = useCallback(async () => {
    if (!activeConversationId) return
    const targetId = activeConversationId
    const ok = await CopilotService.deleteConversation(targetId)
    if (ok) {
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== targetId)
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null)
        return remaining
      })
      setMessages([])
      setError(null)
    }
  }, [activeConversationId])

  // Clear messages in active conversation
  const clearActiveMessages = useCallback(async () => {
    if (!activeConversationId) return
    const ok = await CopilotService.clearMessages(activeConversationId)
    if (ok) {
      setMessages([])
      setError(null)
    }
  }, [activeConversationId])

  // Track action execution states per message ID: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled'
  const [actionStates, setActionStates] = useState({})

  const confirmAction = useCallback(async (messageId, proposal, queryClient) => {
    if (!householdId || !messageId || !proposal) return { success: false, error: 'Invalid confirmation payload' }

    setActionStates((prev) => ({ ...prev, [messageId]: { status: 'executing' } }))

    try {
      const { ActionExecutionService } = await import('../services/ActionExecutionService.js')
      const res = await ActionExecutionService.executeAction({
        householdId,
        actionProposal: proposal,
        queryClient,
      })

      const statusState = {
        status: 'completed',
        result: res.result,
        alreadyExecuted: res.alreadyExecuted,
        completedAt: new Date().toISOString(),
      }

      setActionStates((prev) => ({ ...prev, [messageId]: statusState }))
      fetchMessages(activeConversationId)
      return res
    } catch (err) {
      const errState = {
        status: 'failed',
        error: err.message || 'Action execution failed',
        failedAt: new Date().toISOString(),
      }
      setActionStates((prev) => ({ ...prev, [messageId]: errState }))
      return { success: false, error: err }
    }
  }, [activeConversationId, fetchMessages, householdId])

  const cancelAction = useCallback((messageId) => {
    if (!messageId) return
    setActionStates((prev) => ({
      ...prev,
      [messageId]: { status: 'cancelled', cancelledAt: new Date().toISOString() },
    }))
  }, [])

  // Filter conversations by searchQuery
  const filteredConversations = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
  )

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null

  return {
    conversations: filteredConversations,
    rawConversations: conversations,
    activeConversation,
    activeConversationId,
    messages,
    isLoadingConversations,
    isLoadingMessages,
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
    refetchConversations: fetchConversations,
  }
}
