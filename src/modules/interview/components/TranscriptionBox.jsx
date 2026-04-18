export const TranscriptionBox = ({
  transcript,
  setTranscript,
  onSubmit,
  onClear,
  disabled,
  isSubmitting,
}) => (
  <section className="panel stack">
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <p className="kicker" style={{ margin: 0 }}>
        Transcript Input
      </p>
      <span className="muted">Manual fallback enabled</span>
    </div>

    <label>
      Your answer
      <textarea
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        placeholder="Type your interview answer here if microphone capture is unavailable..."
        disabled={disabled}
      />
    </label>

    <div className="row">
      <button type="button" onClick={onSubmit} disabled={disabled || isSubmitting || !transcript.trim()}>
        {isSubmitting ? 'Submitting...' : 'Confirm Answer'}
      </button>
      <button type="button" className="button-secondary" onClick={onClear} disabled={disabled || isSubmitting}>
        Retry Answer
      </button>
    </div>
  </section>
);
