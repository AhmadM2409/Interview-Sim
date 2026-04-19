import '@testing-library/jest-dom/vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewSessionPage } from '../src/modules/interview/pages/InterviewSessionPage.jsx';
import { ApiError } from '../src/modules/shared/api/client.js';
import { renderWithProviders } from './test-utils.jsx';
import {
  completeInterviewSession,
  evaluateInterviewAnswer,
  getCurrentInterviewQuestion,
  getCurrentQuestionAudio,
  getNextInterviewQuestion,
  requestCodingAssistantFeedback,
} from '../src/modules/interview/api/interviewApi.js';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, language, height }) => (
    <textarea
      aria-label="Code editor"
      data-language={language}
      data-height={height}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('../src/modules/interview/api/interviewApi.js', () => ({
  getCurrentInterviewQuestion: vi.fn(),
  evaluateInterviewAnswer: vi.fn(),
  getNextInterviewQuestion: vi.fn(),
  completeInterviewSession: vi.fn(),
  getCurrentQuestionAudio: vi.fn(),
  requestCodingAssistantFeedback: vi.fn(),
}));

const createDeferred = () => {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

let mockRecognitionInstance = null;

class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = 'en-US';
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.start = vi.fn();
    this.stop = vi.fn(() => {
      if (this.onend) {
        this.onend();
      }
    });
    mockRecognitionInstance = this;
  }
}

const emitRecognitionResult = (chunks) => {
  if (!mockRecognitionInstance?.onresult) {
    throw new Error('Mock speech recognition was not initialized');
  }

  const results = chunks.map((chunk) => {
    const alternatives = [{ transcript: chunk.transcript }];
    alternatives.isFinal = chunk.isFinal;
    return alternatives;
  });

  mockRecognitionInstance.onresult({
    resultIndex: 0,
    results,
  });
};

describe('Interview session page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecognitionInstance = null;
    window.SpeechRecognition = undefined;
    window.webkitSpeechRecognition = undefined;
    getNextInterviewQuestion.mockResolvedValue({ questionId: 'q2', questionText: 'Next question', order: 2 });
    completeInterviewSession.mockResolvedValue({ status: 'COMPLETED', summary: {} });
    getCurrentQuestionAudio.mockResolvedValue({
      audioBase64: 'bW9jay1hdWRpbw==',
      mimeType: 'audio/mpeg',
      voiceId: 'voice-1',
    });
    requestCodingAssistantFeedback.mockResolvedValue({
      responseText: 'Good signal: you are narrating your reasoning clearly.',
      goodSignals: ['You are narrating your reasoning clearly.'],
      missingOrRisky: ['You still need to state the edge case you will handle next.'],
      questionableAssumptions: [],
      suggestedNextStep: 'Call out the next edge case, then update the code.',
      audioBase64: 'bW9jay1hc3Npc3RhbnQtYXVkaW8=',
      mimeType: 'audio/mpeg',
    });
  });

  afterEach(() => {
    window.SpeechRecognition = undefined;
    window.webkitSpeechRecognition = undefined;
    mockRecognitionInstance = null;
  });

  it('renders loading then shows current question', async () => {
    getCurrentInterviewQuestion.mockResolvedValue({ questionId: 'q1', questionText: 'Tell me about your project.', order: 1 });

    renderWithProviders(<InterviewSessionPage sessionId="session-1" onCompleted={vi.fn()} />);

    expect(screen.getByText(/loading interview session/i)).toBeInTheDocument();
    expect(await screen.findByText(/tell me about your project/i)).toBeInTheDocument();
  });

  it('shows retryable error state when current question fetch fails', async () => {
    getCurrentInterviewQuestion.mockRejectedValue(new ApiError('Session not found', 404));

    renderWithProviders(<InterviewSessionPage sessionId="bad-session" onCompleted={vi.fn()} />);

    expect(await screen.findByText(/could not load current question/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('prevents duplicate answer submissions while evaluate request is pending', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();

    getCurrentInterviewQuestion.mockResolvedValue({ questionId: 'q1', questionText: 'Question one', order: 1 });
    evaluateInterviewAnswer.mockReturnValue(deferred.promise);

    renderWithProviders(<InterviewSessionPage sessionId="session-2" onCompleted={vi.fn()} />);

    await screen.findByText(/question one/i);

    await user.type(screen.getByLabelText(/your answer/i), 'My transcript answer.');
    const submitButton = screen.getByRole('button', { name: /confirm answer/i });

    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    await user.click(submitButton);

    expect(evaluateInterviewAnswer).toHaveBeenCalledTimes(1);

    deferred.resolve({
      questionId: 'q1',
      scores: {
        technicalScore: 80,
        communicationScore: 75,
        feedback: 'Solid answer',
      },
    });

    await screen.findByText(/solid answer/i);
  });

  it('shows non-blocking microphone unavailable message when browser STT is unsupported', async () => {
    getCurrentInterviewQuestion.mockResolvedValue({ questionId: 'q1', questionText: 'Question one', order: 1 });

    renderWithProviders(<InterviewSessionPage sessionId="session-5" onCompleted={vi.fn()} />);

    expect(await screen.findByText(/question one/i)).toBeInTheDocument();
    expect(screen.getByText(/microphone input is not available in this browser/i)).toBeInTheDocument();
  });

  it('requests ElevenLabs audio for current question and surfaces playback failure', async () => {
    const user = userEvent.setup();
    getCurrentInterviewQuestion.mockResolvedValue({ questionId: 'q1', questionText: 'Question one', order: 1 });
    getCurrentQuestionAudio.mockRejectedValue(new ApiError('Question audio generation failed', 502));

    renderWithProviders(<InterviewSessionPage sessionId="session-6" onCompleted={vi.fn()} />);

    await screen.findByText(/question one/i);
    await user.click(screen.getByRole('button', { name: /play question audio/i }));

    await waitFor(() => {
      expect(getCurrentQuestionAudio).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText(/question audio generation failed/i)).toBeInTheDocument();
  });

  it('renders a playable audio element after question audio loads successfully', async () => {
    const user = userEvent.setup();
    getCurrentInterviewQuestion.mockResolvedValue({ questionId: 'q1', questionText: 'Question one', order: 1 });

    renderWithProviders(<InterviewSessionPage sessionId="session-audio" onCompleted={vi.fn()} />);

    await screen.findByText(/question one/i);
    await user.click(screen.getByRole('button', { name: /play question audio/i }));

    await waitFor(() => {
      expect(getCurrentQuestionAudio).toHaveBeenCalledTimes(1);
    });

    const audio = screen.getByText(/your browser does not support audio playback/i).closest('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toContain('data:audio/mpeg;base64,');
  });

  it('keeps speech recognition transcript clean without duplicating interim and final fragments', async () => {
    const user = userEvent.setup();
    window.SpeechRecognition = MockSpeechRecognition;
    getCurrentInterviewQuestion.mockResolvedValue({ questionId: 'q1', questionText: 'Question one', order: 1 });

    renderWithProviders(<InterviewSessionPage sessionId="session-7" onCompleted={vi.fn()} />);

    await screen.findByText(/question one/i);
    await user.click(screen.getByRole('button', { name: /start recording/i }));

    emitRecognitionResult([
      { transcript: 'I do not know', isFinal: false },
    ]);

    await waitFor(() => {
      expect(screen.getByLabelText(/your answer/i)).toHaveValue('I do not know');
    });

    emitRecognitionResult([
      { transcript: 'I do not know the answer to this', isFinal: true },
    ]);

    await waitFor(() => {
      expect(screen.getByLabelText(/your answer/i)).toHaveValue('I do not know the answer to this');
    });
  });

  it('retry answer clears stale speech transcript so a new recording starts cleanly', async () => {
    const user = userEvent.setup();
    window.SpeechRecognition = MockSpeechRecognition;
    getCurrentInterviewQuestion.mockResolvedValue({ questionId: 'q1', questionText: 'Question one', order: 1 });

    renderWithProviders(<InterviewSessionPage sessionId="session-8" onCompleted={vi.fn()} />);

    await screen.findByText(/question one/i);
    await user.click(screen.getByRole('button', { name: /start recording/i }));

    emitRecognitionResult([
      { transcript: 'First attempt', isFinal: true },
    ]);

    await waitFor(() => {
      expect(screen.getByLabelText(/your answer/i)).toHaveValue('First attempt');
    });

    await user.click(screen.getByRole('button', { name: /retry answer/i }));
    expect(screen.getByLabelText(/your answer/i)).toHaveValue('');

    await user.click(screen.getByRole('button', { name: /start recording/i }));
    emitRecognitionResult([
      { transcript: 'Second attempt', isFinal: true },
    ]);

    await waitFor(() => {
      expect(screen.getByLabelText(/your answer/i)).toHaveValue('Second attempt');
    });
  });

  it('allows manual editing after speech recognition populates the transcript', async () => {
    const user = userEvent.setup();
    window.SpeechRecognition = MockSpeechRecognition;
    getCurrentInterviewQuestion.mockResolvedValue({ questionId: 'q1', questionText: 'Question one', order: 1 });

    renderWithProviders(<InterviewSessionPage sessionId="session-9" onCompleted={vi.fn()} />);

    await screen.findByText(/question one/i);
    await user.click(screen.getByRole('button', { name: /start recording/i }));

    emitRecognitionResult([
      { transcript: 'Generated by speech', isFinal: true },
    ]);

    await waitFor(() => {
      expect(screen.getByLabelText(/your answer/i)).toHaveValue('Generated by speech');
    });

    await user.clear(screen.getByLabelText(/your answer/i));
    await user.type(screen.getByLabelText(/your answer/i), 'Edited manually');

    expect(screen.getByLabelText(/your answer/i)).toHaveValue('Edited manually');
  });

  it('supports coding speech transcription and language selection, then submits both with the code answer', async () => {
    const user = userEvent.setup();
    window.SpeechRecognition = MockSpeechRecognition;
    getCurrentInterviewQuestion.mockResolvedValue({
      questionId: 'q-code-speech',
      questionText: 'Implement a function that groups anagrams.',
      order: 2,
      type: 'coding',
      language: 'javascript',
      supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'cpp'],
    });
    evaluateInterviewAnswer.mockResolvedValue({
      questionId: 'q-code-speech',
      scores: {
        technicalScore: 86,
        problemSolvingScore: 82,
        communicationScore: 78,
        feedback: 'Strong coding answer.',
        finalFeedback: 'Strong coding answer.',
      },
    });

    renderWithProviders(<InterviewSessionPage sessionId="session-code-speech" onCompleted={vi.fn()} />);

    await screen.findByText(/implement a function that groups anagrams/i);
    await user.click(screen.getByRole('button', { name: /open coding environment/i }));

    await user.selectOptions(screen.getByRole('combobox', { name: /language/i }), 'python');
    expect(screen.getByLabelText(/code editor/i)).toHaveAttribute('data-language', 'python');

    await user.click(screen.getByRole('button', { name: /start recording/i }));
    emitRecognitionResult([
      { transcript: 'I would use a dictionary keyed by sorted letters and handle empty input.', isFinal: true },
    ]);

    await waitFor(() => {
      expect(screen.getByLabelText(/reasoning transcript/i)).toHaveValue(
        'I would use a dictionary keyed by sorted letters and handle empty input.',
      );
    });

    fireEvent.change(screen.getByLabelText(/code editor/i), {
      target: {
        value: 'def solve(words):\n    return words',
      },
    });

    await user.click(screen.getByRole('button', { name: /confirm answer/i }));

    await waitFor(() => {
      expect(evaluateInterviewAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-code-speech',
          type: 'coding',
          code: 'def solve(words):\n    return words',
          language: 'python',
          transcript: 'I would use a dictionary keyed by sorted letters and handle empty input.',
        }),
      );
    });
  });

  it(
    'requests coding assistant feedback automatically after a reasoning pause and shows the voice reply audio',
    async () => {
      getCurrentInterviewQuestion.mockResolvedValue({
        questionId: 'q-code-assistant',
        questionText: 'Implement a function that merges overlapping intervals.',
        order: 2,
        type: 'coding',
        language: 'javascript',
      });

      renderWithProviders(<InterviewSessionPage sessionId="session-code-assistant" onCompleted={vi.fn()} />);

      await screen.findByText(/implement a function that merges overlapping intervals/i);
      fireEvent.click(screen.getByRole('button', { name: /open coding environment/i }));
      fireEvent.click(screen.getByLabelText(/voice replies/i));
      fireEvent.change(screen.getByLabelText(/reasoning transcript/i), {
        target: {
          value: 'I will sort first and then merge intervals while walking through the array.',
        },
      });

      await waitFor(
        () => {
          expect(requestCodingAssistantFeedback).toHaveBeenCalledWith(
            expect.objectContaining({
              sessionId: 'session-code-assistant',
              transcript: 'I will sort first and then merge intervals while walking through the array.',
              language: 'javascript',
              includeAudio: true,
            }),
          );
        },
        { timeout: 5000 },
      );

      expect(await screen.findByText(/live interviewer feedback/i)).toBeInTheDocument();
      const audio = screen.getByText(/your browser does not support audio playback/i).closest('audio');
      expect(audio).not.toBeNull();
    },
    10000,
  );

  it('opens a coding editor on demand for coding questions and submits code instead of transcript', async () => {
    const user = userEvent.setup();
    getCurrentInterviewQuestion.mockResolvedValue({
      questionId: 'q-code',
      questionText: 'Write a JavaScript function that reverses a string.',
      order: 2,
      type: 'coding',
      language: 'javascript',
    });
    evaluateInterviewAnswer.mockResolvedValue({
      questionId: 'q-code',
      scores: {
        technicalScore: 84,
        problemSolvingScore: 80,
        communicationScore: 72,
        feedback: 'Good start with a correct implementation.',
        finalFeedback: 'Good start with a correct implementation.',
      },
    });

    renderWithProviders(<InterviewSessionPage sessionId="session-code" onCompleted={vi.fn()} />);

    await screen.findByText(/write a javascript function that reverses a string/i);
    expect(screen.queryByLabelText(/your answer/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/code editor/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open coding environment/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open coding environment/i }));
    expect(screen.getByLabelText(/code editor/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/code editor/i), {
      target: {
        value: 'function reverseString(value) { return value.split(\"\").reverse().join(\"\"); }',
      },
    });
    await user.click(screen.getByRole('button', { name: /run code/i }));

    expect(await screen.findByText(/code ran successfully/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm answer/i }));

    await waitFor(() => {
      expect(evaluateInterviewAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
            sessionId: 'session-code',
            type: 'coding',
            code: 'function reverseString(value) { return value.split(\"\").reverse().join(\"\"); }',
            language: 'javascript',
            transcript: '',
          }),
        );
    });

    expect(await screen.findByText(/good start with a correct implementation/i)).toBeInTheDocument();
  });

  it('infers a coding question from keywords when question.type is missing', async () => {
    const user = userEvent.setup();
    getCurrentInterviewQuestion.mockResolvedValue({
      questionId: 'q-inferred',
      questionText: 'Implement an algorithm to merge two sorted arrays.',
      order: 3,
    });

    renderWithProviders(<InterviewSessionPage sessionId="session-inferred" onCompleted={vi.fn()} />);

    await screen.findByText(/implement an algorithm to merge two sorted arrays/i);
    expect(screen.getByRole('button', { name: /open coding environment/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open coding environment/i }));
    expect(screen.getByLabelText(/code editor/i)).toBeInTheDocument();
  });

  it('still progresses to the next question after a coding answer is submitted', async () => {
    const user = userEvent.setup();
    getCurrentInterviewQuestion.mockResolvedValue({
      questionId: 'q-code-progress',
      questionText: 'Write a JavaScript function that reverses a string.',
      order: 1,
      type: 'coding',
      language: 'javascript',
    });
    evaluateInterviewAnswer.mockResolvedValue({
      questionId: 'q-code-progress',
      scores: {
        technicalScore: 82,
        problemSolvingScore: 76,
        communicationScore: 70,
        feedback: 'Solid coding answer.',
        finalFeedback: 'Solid coding answer.',
      },
    });
    getNextInterviewQuestion.mockResolvedValue({
      questionId: 'q-verbal-next',
      questionText: 'Tell me about a system you designed.',
      order: 2,
      type: 'verbal',
    });

    renderWithProviders(<InterviewSessionPage sessionId="session-code-progress" onCompleted={vi.fn()} />);

    await screen.findByText(/write a javascript function that reverses a string/i);
    await user.click(screen.getByRole('button', { name: /open coding environment/i }));

    fireEvent.change(screen.getByLabelText(/code editor/i), {
      target: {
        value: 'function reverseString(value) { return value.split(\"\").reverse().join(\"\"); }',
      },
    });

    await user.click(screen.getByRole('button', { name: /confirm answer/i }));
    expect(await screen.findByText(/solid coding answer/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next question/i }));
    expect(await screen.findByText(/tell me about a system you designed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
  });
});
