export const QuestionCard = ({ question, order, type = 'verbal', language = null }) => (
  <section className="panel stack" aria-live="polite">
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <p className="kicker" style={{ margin: 0 }}>
        Current Question
      </p>
      <div className="row" style={{ gap: 8 }}>
        <span className="badge">{type === 'coding' ? 'Coding' : 'Verbal'}</span>
        {language ? <span className="badge">{language}</span> : null}
        <span className="badge">Q{order}</span>
      </div>
    </div>
    <h2 style={{ margin: 0, lineHeight: 1.35 }}>{question}</h2>
  </section>
);
