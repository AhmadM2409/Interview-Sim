import '@testing-library/jest-dom/vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InterviewSetupPage } from '../src/modules/interview/pages/InterviewSetupPage.jsx';
import { ApiError } from '../src/modules/shared/api/client.js';
import { renderWithProviders } from './test-utils.jsx';
import { createInterviewSession } from '../src/modules/interview/api/interviewApi.js';

vi.mock('../src/modules/interview/api/interviewApi.js', () => ({
  createInterviewSession: vi.fn(),
}));

describe('Interview setup page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits setup form and navigates to session on success', async () => {
    const user = userEvent.setup();
    const onSessionCreated = vi.fn();

    createInterviewSession.mockResolvedValue({
      sessionId: 'session-123',
      role: 'Frontend Engineer',
      level: 'Senior',
      status: 'ACTIVE',
    });

    renderWithProviders(<InterviewSetupPage onSessionCreated={onSessionCreated} />);

    await user.clear(screen.getByLabelText(/target role/i));
    await user.type(screen.getByLabelText(/target role/i), 'Backend Engineer');
    await user.selectOptions(screen.getByLabelText(/experience level/i), 'Senior');
    await user.click(screen.getByRole('button', { name: /start interview/i }));

    await waitFor(() => {
      expect(createInterviewSession).toHaveBeenCalledTimes(1);
      expect(onSessionCreated).toHaveBeenCalledWith('session-123');
    });
  });

  it('shows visible backend error when session creation fails', async () => {
    const user = userEvent.setup();

    createInterviewSession.mockRejectedValue(new ApiError('Session creation failed', 500));

    renderWithProviders(<InterviewSetupPage onSessionCreated={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /start interview/i }));

    expect(await screen.findByText(/session creation failed/i)).toBeInTheDocument();
  });
});
