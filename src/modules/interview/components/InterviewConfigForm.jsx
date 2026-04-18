import { useState } from 'react';

const DEFAULT_LEVEL = 'Mid';

export const InterviewConfigForm = ({ onSubmit, isSubmitting, errorMessage }) => {
  const [role, setRole] = useState('Frontend Engineer');
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [fieldError, setFieldError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!role.trim()) {
      setFieldError('Role is required.');
      return;
    }

    if (!level.trim()) {
      setFieldError('Level is required.');
      return;
    }

    setFieldError('');

    try {
      await onSubmit({ role: role.trim(), level: level.trim() });
    } catch (_error) {
      // Error state is surfaced by the parent mutation state.
    }
  };

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      <p className="kicker">Interview Setup</p>
      <label>
        Target role
        <input
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          placeholder="e.g. Backend Engineer"
          disabled={isSubmitting}
        />
      </label>

      <label>
        Experience level
        <select name="level" value={level} onChange={(event) => setLevel(event.target.value)} disabled={isSubmitting}>
          <option value="Junior">Junior</option>
          <option value="Mid">Mid</option>
          <option value="Senior">Senior</option>
        </select>
      </label>

      {fieldError ? <div className="alert">{fieldError}</div> : null}
      {errorMessage ? <div className="alert">{errorMessage}</div> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating session...' : 'Start Interview'}
      </button>
    </form>
  );
};
