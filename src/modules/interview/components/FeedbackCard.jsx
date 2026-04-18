export const FeedbackCard = ({ feedback }) => {
  if (!feedback) {
    return (
      <section className="panel stack">
        <p className="kicker" style={{ margin: 0 }}>
          Structured Feedback
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Submit an answer to see technical and communication scores.
        </p>
      </section>
    );
  }

  return (
    <section className="panel stack">
      <p className="kicker" style={{ margin: 0 }}>
        Structured Feedback
      </p>
      <div className="metric-grid">
        <div className="metric">
          <p className="kicker" style={{ marginBottom: 6 }}>
            Technical
          </p>
          <strong className="score">{feedback.technicalScore}</strong>
        </div>
        <div className="metric">
          <p className="kicker" style={{ marginBottom: 6 }}>
            Communication
          </p>
          <strong className="score">{feedback.communicationScore}</strong>
        </div>
        <div className="metric">
          <p className="kicker" style={{ marginBottom: 6 }}>
            Rating
          </p>
          <strong className="score">{Math.round((feedback.technicalScore + feedback.communicationScore) / 2)}</strong>
        </div>
      </div>
      <p style={{ margin: 0 }}>{feedback.feedback}</p>
    </section>
  );
};
