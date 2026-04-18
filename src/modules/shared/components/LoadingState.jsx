export const LoadingState = ({ title = 'Loading...', message = 'Please wait while we prepare your session.' }) => (
  <div className="panel stack" role="status" aria-live="polite">
    <p className="kicker">Loading</p>
    <strong>{title}</strong>
    <p className="muted">{message}</p>
  </div>
);
