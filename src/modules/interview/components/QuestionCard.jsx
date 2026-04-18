export const QuestionCard = ({ question, order }) => (
  <section className="panel stack" aria-live="polite">
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <p className="kicker" style={{ margin: 0 }}>
        Current Question
      </p>
      <span className="badge">Q{order}</span>
    </div>
    <h2 style={{ margin: 0, lineHeight: 1.35 }}>{question}</h2>
  </section>
);
