import '@testing-library/jest-dom/vitest';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InterviewSummaryPage } from '../src/modules/interview/pages/InterviewSummaryPage.jsx';
import { ApiError } from '../src/modules/shared/api/client.js';
import { renderWithProviders } from './test-utils.jsx';
import { getInterviewSummary } from '../src/modules/interview/api/interviewApi.js';

vi.mock('../src/modules/interview/api/interviewApi.js', () => ({
  getInterviewSummary: vi.fn(),
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
        strengths: ['Communication clarity'],
        improvements: ['More metric depth'],
      },
    });

    renderWithProviders(<InterviewSummaryPage sessionId="session-3" />);

    expect(await screen.findByText('84')).toBeInTheDocument();
    expect(screen.getByText(/communication clarity/i)).toBeInTheDocument();
    expect(screen.getByText(/more metric depth/i)).toBeInTheDocument();
  });

  it('shows error state and retry when fetch fails', async () => {
    getInterviewSummary.mockRejectedValue(new ApiError('Summary unavailable', 500));

    renderWithProviders(<InterviewSummaryPage sessionId="session-4" />);

    expect(await screen.findByText(/could not load summary/i)).toBeInTheDocument();
    expect(screen.getByText(/summary unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
