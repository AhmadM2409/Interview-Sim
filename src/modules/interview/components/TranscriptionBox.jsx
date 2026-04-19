import { useSpeechTranscription } from '../hooks/useSpeechTranscription.js';

export const TranscriptionBox = ({
  transcript,
  setTranscript,
  onSubmit,
  onClear,
  disabled,
  isSubmitting,
}) => {
  const {
    isListening,
    speechError,
    isSpeechSupported,
    startListening,
    stopListening,
    resetRecognitionState,
  } = useSpeechTranscription({
    value: transcript,
    onChange: setTranscript,
  });

  const handleClear = () => {
    stopListening();
    resetRecognitionState();
    onClear();
  };

  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p className="kicker" style={{ margin: 0 }}>
          Transcript Input
        </p>
        <span className="muted">Manual fallback enabled</span>
      </div>

      {isSpeechSupported ? (
        <div className="row">
          <button
            type="button"
            className="button-secondary"
            onClick={() => startListening({ disabled, isSubmitting })}
            disabled={disabled || isSubmitting || isListening}
          >
            Start Recording
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={stopListening}
            disabled={disabled || isSubmitting || !isListening}
          >
            Stop Recording
          </button>
          <span className="muted">{isListening ? 'Listening...' : 'Microphone ready'}</span>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Microphone input is not available in this browser. You can continue with manual transcript entry.
        </p>
      )}

      {speechError ? <div className="alert warning">{speechError}</div> : null}

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
        <button type="button" className="button-secondary" onClick={handleClear} disabled={disabled || isSubmitting}>
          Retry Answer
        </button>
      </div>
    </section>
  );
};
