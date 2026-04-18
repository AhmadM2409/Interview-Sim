import '@testing-library/jest-dom/vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewSessionPage } from '../src/modules/interview/pages/InterviewSessionPage.jsx';
import { ApiError } from '../src/modules/shared/api/client.js';
import { renderWithProviders } from './test-utils.jsx';
import {
  completeInterviewSession,
  evaluateInterviewAnswer,
  getCurrentInterviewQuestion,
  getNextInterviewQuestion,
} from '../src/modules/interview/api/interviewApi.js';

vi.mock('../src/modules/interview/api/interviewApi.js', () => ({
  getCurrentInterviewQuestion: vi.fn(),
  evaluateInterviewAnswer: vi.fn(),
  getNextInterviewQuestion: vi.fn(),
  completeInterviewSession: vi.fn(),
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

describe('Interview session page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNextInterviewQuestion.mockResolvedValue({ questionId: 'q2', questionText: 'Next question', order: 2 });
    completeInterviewSession.mockResolvedValue({ status: 'COMPLETED', summary: {} });
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
});
