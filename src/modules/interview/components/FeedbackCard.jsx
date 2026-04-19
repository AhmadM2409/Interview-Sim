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

  const isCodingFeedback = typeof feedback.problemSolvingScore === 'number';
  const rating = isCodingFeedback
    ? Math.round((feedback.technicalScore + feedback.problemSolvingScore + feedback.communicationScore) / 3)
    : Math.round((feedback.technicalScore + feedback.communicationScore) / 2);

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
        {isCodingFeedback ? (
          <div className="metric">
            <p className="kicker" style={{ marginBottom: 6 }}>
              Problem Solving
            </p>
            <strong className="score">{feedback.problemSolvingScore}</strong>
          </div>
        ) : null}
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
          <strong className="score">{rating}</strong>
        </div>
      </div>
      <p style={{ margin: 0 }}>{feedback.finalFeedback ?? feedback.feedback}</p>
      {feedback.strengths?.length ? (
        <p style={{ margin: 0 }}>
          <strong>Strengths:</strong> {feedback.strengths.join(' ')}
        </p>
      ) : null}
      {feedback.weaknesses?.length ? (
        <p style={{ margin: 0 }}>
          <strong>Weaknesses:</strong> {feedback.weaknesses.join(' ')}
        </p>
      ) : null}
      {feedback.edgeCasesMissing?.length ? (
        <p style={{ margin: 0 }}>
          <strong>Edge cases:</strong> {feedback.edgeCasesMissing.join(' ')}
        </p>
      ) : null}
      {feedback.codeQualityNotes?.length ? (
        <p style={{ margin: 0 }}>
          <strong>Code quality:</strong> {feedback.codeQualityNotes.join(' ')}
        </p>
      ) : null}
    </section>
  );
};
