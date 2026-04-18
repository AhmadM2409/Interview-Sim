/**
 * Terminal Entry Layer
 *
 * This module provides the integration surface for a future terminal UI.
 * It exposes streaming input handlers that feed into the coaching session.
 *
 * A future teammate implementing the real terminal UI should:
 * 1. Import `createTerminalEntry` and bind it to their terminal component
 * 2. Call `onInputChunk` on each keystroke
 * 3. Call `finalizeSubmission` when the user presses Enter/submits
 * 4. The coaching system handles the rest
 */

import type { TerminalEntryPoint } from '../types';

export interface TerminalEntryOptions {
  onBufferChange?: (buffer: string) => void;
  onSubmit?: (text: string) => Promise<void>;
  onChunk?: (chunk: string, buffer: string) => void;
  debounceMs?: number;
}

export function createTerminalEntry(options: TerminalEntryOptions = {}): TerminalEntryPoint {
  let buffer = '';
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    options.onBufferChange?.(buffer);
  };

  const scheduleFlush = (ms: number) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, ms);
  };

  return {
    onInputChunk(chunk: string) {
      buffer += chunk;
      options.onChunk?.(chunk, buffer);
      scheduleFlush(options.debounceMs ?? 50);
    },

    onBufferUpdate(newBuffer: string) {
      buffer = newBuffer;
      options.onBufferChange?.(buffer);
    },

    pushTypingDelta(delta: string, _cursorPosition: number) {
      buffer += delta;
      scheduleFlush(options.debounceMs ?? 50);
    },

    async finalizeSubmission(text: string) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      buffer = '';
      await options.onSubmit?.(text);
    },

    clearBuffer() {
      buffer = '';
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      options.onBufferChange?.('');
    },

    getBuffer() {
      return buffer;
    },
  };
}

/** No-op terminal entry for environments where the terminal is absent */
export function createNoOpTerminalEntry(): TerminalEntryPoint {
  return {
    onInputChunk: () => {},
    onBufferUpdate: () => {},
    pushTypingDelta: () => {},
    finalizeSubmission: async () => {},
    clearBuffer: () => {},
    getBuffer: () => '',
  };
}
