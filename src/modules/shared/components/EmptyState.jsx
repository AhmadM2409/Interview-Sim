export const EmptyState = ({ title, message, action }) => (
  <div className="panel stack">
    <p className="kicker">Empty</p>
    <strong>{title}</strong>
    <p className="muted">{message}</p>
    {action ?? null}
  </div>
);
