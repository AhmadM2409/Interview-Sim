export const ErrorState = ({ title = 'Something went wrong', message, onRetry }) => (
  <div className="panel stack" role="alert">
    <p className="kicker">Error</p>
    <strong>{title}</strong>
    <p className="muted">{message}</p>
    {onRetry ? (
      <div>
        <button type="button" className="button-secondary" onClick={onRetry}>
          Retry
        </button>
      </div>
    ) : null}
  </div>
);
