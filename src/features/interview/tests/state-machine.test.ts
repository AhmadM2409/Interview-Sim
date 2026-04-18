/**
 * State machine transition tests — enforces illegal transition rejection
 */

import { describe, expect, it } from 'vitest';
import {
  INITIAL_ENGINE_STATE,
  applyTransition,
  assertTransition,
  canTransition,
} from '../state/machine';

describe('State Machine: valid transitions', () => {
  it('IDLE → FETCHING_CONTEXT', () => {
    expect(() => assertTransition('IDLE', 'FETCHING_CONTEXT')).not.toThrow();
  });

  it('FETCHING_CONTEXT → PLAYING_AUDIO', () => {
    expect(() => assertTransition('FETCHING_CONTEXT', 'PLAYING_AUDIO')).not.toThrow();
  });

  it('PLAYING_AUDIO → AWAITING_MIC', () => {
    expect(() => assertTransition('PLAYING_AUDIO', 'AWAITING_MIC')).not.toThrow();
  });

  it('AWAITING_MIC → RECORDING', () => {
    expect(() => assertTransition('AWAITING_MIC', 'RECORDING')).not.toThrow();
  });

  it('RECORDING → PROCESSING_STT', () => {
    expect(() => assertTransition('RECORDING', 'PROCESSING_STT')).not.toThrow();
  });

  it('PROCESSING_STT → REVIEWING_TRANSCRIPT', () => {
    expect(() => assertTransition('PROCESSING_STT', 'REVIEWING_TRANSCRIPT')).not.toThrow();
  });

  it('REVIEWING_TRANSCRIPT → AWAITING_MIC (retry)', () => {
    expect(() => assertTransition('REVIEWING_TRANSCRIPT', 'AWAITING_MIC')).not.toThrow();
  });

  it('REVIEWING_TRANSCRIPT → EVALUATING (confirm)', () => {
    expect(() => assertTransition('REVIEWING_TRANSCRIPT', 'EVALUATING')).not.toThrow();
  });

  it('EVALUATING → PLAYING_AUDIO (next question)', () => {
    expect(() => assertTransition('EVALUATING', 'PLAYING_AUDIO')).not.toThrow();
  });

  it('EVALUATING → COMPLETING (last question)', () => {
    expect(() => assertTransition('EVALUATING', 'COMPLETING')).not.toThrow();
  });

  it('COMPLETING → FINISHED', () => {
    expect(() => assertTransition('COMPLETING', 'FINISHED')).not.toThrow();
  });
});

describe('State Machine: illegal transitions are rejected', () => {
  it('IDLE → RECORDING is illegal', () => {
    expect(() => assertTransition('IDLE', 'RECORDING')).toThrow('Illegal state transition');
  });

  it('FINISHED → PLAYING_AUDIO is illegal', () => {
    expect(() => assertTransition('FINISHED', 'PLAYING_AUDIO')).toThrow('Illegal state transition');
  });

  it('AWAITING_MIC → EVALUATING is illegal', () => {
    expect(() => assertTransition('AWAITING_MIC', 'EVALUATING')).toThrow('Illegal state transition');
  });

  it('REVIEWING_TRANSCRIPT → COMPLETING is illegal', () => {
    expect(() => assertTransition('REVIEWING_TRANSCRIPT', 'COMPLETING')).toThrow(
      'Illegal state transition',
    );
  });
});

describe('State Machine: canTransition (non-throwing)', () => {
  it('returns true for valid transitions', () => {
    expect(canTransition('IDLE', 'FETCHING_CONTEXT')).toBe(true);
    expect(canTransition('RECORDING', 'PROCESSING_STT')).toBe(true);
  });

  it('returns false for invalid transitions', () => {
    expect(canTransition('IDLE', 'RECORDING')).toBe(false);
    expect(canTransition('FINISHED', 'IDLE')).toBe(false);
  });
});

describe('State Machine: applyTransition', () => {
  it('applies patch and transitions correctly', () => {
    const next = applyTransition(INITIAL_ENGINE_STATE, 'FETCHING_CONTEXT');
    expect(next.phase).toBe('FETCHING_CONTEXT');
  });

  it('clears error on non-error transitions', () => {
    const withError = { ...INITIAL_ENGINE_STATE, phase: 'ERROR' as const, error: 'boom' };
    const recovered = applyTransition(withError, 'IDLE');
    expect(recovered.error).toBeNull();
  });

  it('preserves error message on ERROR transition', () => {
    const state = { ...INITIAL_ENGINE_STATE, phase: 'FETCHING_CONTEXT' as const };
    const errored = applyTransition(state, 'ERROR', { error: 'timeout' });
    expect(errored.error).toBe('timeout');
  });
});
