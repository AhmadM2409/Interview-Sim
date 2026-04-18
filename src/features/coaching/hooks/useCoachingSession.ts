import { useCallback, useMemo, useRef, useState } from 'react';
import { createNoOpTerminalEntry, createTerminalEntry } from '../terminal-entry';
import type { CoachingMessage, CoachingState, TerminalEntryPoint } from '../types';
import { getLLMProvider } from '../../../shared/lib/llm';
import { withRetry } from '../../../shared/lib/resilience/retry';

interface UseCoachingSessionOptions {
  sessionId: string;
  userId: string;
  problemContext: string;
  /** Pass false when running without a terminal (coding editor, etc.) */
  enableTerminal?: boolean;
}

interface UseCoachingSessionReturn {
  state: CoachingState;
  messages: CoachingMessage[];
  terminal: TerminalEntryPoint;
  submitMessage: (text: string) => Promise<void>;
  clearError: () => void;
}

export function useCoachingSession({
  sessionId,
  userId: _userId,
  problemContext,
  enableTerminal = false,
}: UseCoachingSessionOptions): UseCoachingSessionReturn {
  const [state, setState] = useState<CoachingState>({
    phase: 'IDLE',
    sessionId,
    inputBuffer: '',
    pendingChunks: [],
    coachResponse: null,
    error: null,
  });

  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const submitMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMsg: CoachingMessage = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setState((prev) => ({ ...prev, phase: 'PROCESSING', inputBuffer: '' }));

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const llm = getLLMProvider();

        const history = [...messages, userMsg];
        const contextMessages = history.slice(-10); // keep last 10 for context window

        const response = await withRetry(
          () =>
            llm.complete({
              messages: [
                {
                  role: 'system',
                  content: `You are a live coding coach helping a candidate during a coding interview. Problem context:\n\n${problemContext}\n\nProvide concise, actionable hints without giving away the solution directly.`,
                },
                ...contextMessages.map((m) => ({
                  role: m.role === 'coach' ? ('assistant' as const) : ('user' as const),
                  content: m.content,
                })),
              ],
              temperature: 0.4,
              maxTokens: 400,
            }),
          { maxAttempts: 2, baseDelayMs: 500 },
        );

        const coachMsg: CoachingMessage = {
          role: 'coach',
          content: response.content.trim(),
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, coachMsg]);
        setState((prev) => ({
          ...prev,
          phase: 'ACTIVE',
          coachResponse: coachMsg.content,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          phase: 'ERROR',
          error: err instanceof Error ? err.message : 'Coach unavailable',
        }));
      }
    },
    [messages, problemContext],
  );

  // Terminal entry point — wired or no-op depending on enableTerminal flag
  const terminal = useMemo<TerminalEntryPoint>(() => {
    if (!enableTerminal) return createNoOpTerminalEntry();

    return createTerminalEntry({
      onBufferChange: (buffer) => {
        setState((prev) => ({ ...prev, inputBuffer: buffer }));
      },
      onChunk: (chunk, buffer) => {
        setState((prev) => ({
          ...prev,
          phase: buffer.length > 0 ? 'STREAMING' : 'ACTIVE',
          pendingChunks: [...prev.pendingChunks, chunk],
        }));
      },
      onSubmit: submitMessage,
      debounceMs: 60,
    });
  }, [enableTerminal, submitMessage]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'ACTIVE', error: null }));
  }, []);

  return { state, messages, terminal, submitMessage, clearError };
}
