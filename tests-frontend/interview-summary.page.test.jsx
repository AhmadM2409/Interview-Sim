import '@testing-library/jest-dom/vitest';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewSummaryPage } from '../src/modules/interview/pages/InterviewSummaryPage.jsx';
import { ApiError } from '../src/modules/shared/api/client.js';
import { renderWithProviders } from './test-utils.jsx';
import { getInterviewSummary, getInterviewHistory } from '../src/modules/interview/api/interviewApi.js';

vi.mock('../src/modules/interview/api/interviewApi.js', () => ({
  getInterviewSummary: vi.fn(),
  getInterviewHistory: vi.fn(),
}));

describe('Interview summary page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows summary details when fetch succeeds', async () => {
    getInterviewSummary.mockResolvedValue({
      status: 'COMPLETED',
      summary: {
        overallScore: 84,
        technicalScore: 81,
        communicationScore: 79,
        strengths: ['Communication clarity'],
        improvements: ['More metric depth'],
      },
    });
    getInterviewHistory.mockResolvedValue({
      sessions: [
        {
          sessionId: 'session-3',
          role: 'Backend Engineer',
          status: 'COMPLETED',
          finalScore: 84,
          createdAt: '2026-04-18T11:00:00.000Z',
        },
        {
          sessionId: 'session-1',
          role: 'Frontend Engineer',
          status: 'COMPLETED',
          finalScore: 77,
          createdAt: '2026-04-17T11:00:00.000Z',
        },
      ],
    });

    renderWithProviders(<InterviewSummaryPage sessionId="session-3" />);

    expect(await screen.findByText('84')).toBeInTheDocument();
    expect(screen.getByText('81')).toBeInTheDocument();
    expect(screen.getByText('79')).toBeInTheDocument();
    expect(screen.getByText(/communication clarity/i)).toBeInTheDocument();
    expect(screen.getByText(/more metric depth/i)).toBeInTheDocument();
    expect(screen.getByText(/previous attempts/i)).toBeInTheDocument();
    expect(screen.getByText(/frontend engineer/i)).toBeInTheDocument();
  });

  it('shows error state and retry when fetch fails', async () => {
    getInterviewSummary.mockRejectedValue(new ApiError('Summary unavailable', 500));
    getInterviewHistory.mockResolvedValue({ sessions: [] });

    renderWithProviders(<InterviewSummaryPage sessionId="session-4" />);

    expect(await screen.findByText(/could not load summary/i)).toBeInTheDocument();
    expect(screen.getByText(/summary unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders history fallback message when history fetch fails but summary succeeds', async () => {
    getInterviewSummary.mockResolvedValue({
      status: 'COMPLETED',
      summary: {
        overallScore: 73,
        technicalScore: null,
        communicationScore: null,
        strengths: ['Persistence'],
        improvements: ['Improve answer depth'],
      },
    });
    getInterviewHistory.mockRejectedValue(new ApiError('History unavailable', 500));

    renderWithProviders(<InterviewSummaryPage sessionId="session-8" />);

    expect(await screen.findByText('73')).toBeInTheDocument();
    expect(screen.getByText(/unable to load previous attempts right now/i)).toBeInTheDocument();
  });
});
