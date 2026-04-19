import { useEffect, useMemo, useRef, useState } from 'react';

const getSpeechRecognitionCtor = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const TranscriptionBox = ({
  transcript,
  setTranscript,
  onSubmit,
  onClear,
  disabled,
  isSubmitting,
}) => {
  const recognitionRef = useRef(null);
  const transcriptRef = useRef(transcript);
  const recognitionSessionRef = useRef({
    baseTranscript: '',
    finalTranscript: '',
    interimTranscript: '',
  });
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const speechCtor = useMemo(getSpeechRecognitionCtor, []);
  const isSpeechSupported = Boolean(speechCtor);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (!speechCtor) {
      return;
    }

    const recognition = new speechCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const nextFinalParts = [];
      const nextInterimParts = [];

      for (const result of Array.from(event.results)) {
        const segment = result[0]?.transcript?.trim();

        if (!segment) {
          continue;
        }

        if (result.isFinal) {
          nextFinalParts.push(segment);
          continue;
        }

        nextInterimParts.push(segment);
      }

      recognitionSessionRef.current.finalTranscript = nextFinalParts.join(' ').trim();
      recognitionSessionRef.current.interimTranscript = nextInterimParts.join(' ').trim();

      const nextTranscript = [
        recognitionSessionRef.current.baseTranscript,
        recognitionSessionRef.current.finalTranscript,
        recognitionSessionRef.current.interimTranscript,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      setTranscript(nextTranscript);
    };

    recognition.onerror = (event) => {
      setSpeechError(`Microphone capture failed: ${event.error ?? 'unknown error'}`);
      recognitionSessionRef.current.baseTranscript = transcriptRef.current.trim();
      recognitionSessionRef.current.finalTranscript = '';
      recognitionSessionRef.current.interimTranscript = '';
      setIsListening(false);
    };

    recognition.onend = () => {
      recognitionSessionRef.current.baseTranscript = transcriptRef.current.trim();
      recognitionSessionRef.current.finalTranscript = '';
      recognitionSessionRef.current.interimTranscript = '';
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch (_error) {
        // no-op
      }
      recognitionRef.current = null;
    };
  }, [setTranscript, speechCtor]);

  const handleStartListening = () => {
    if (!recognitionRef.current || disabled || isSubmitting) {
      return;
    }

    setSpeechError('');
    recognitionSessionRef.current.baseTranscript = transcriptRef.current.trim();
    recognitionSessionRef.current.finalTranscript = '';
    recognitionSessionRef.current.interimTranscript = '';

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (_error) {
      setSpeechError('Microphone could not start. Please use manual transcript entry.');
      setIsListening(false);
    }
  };

  const handleStopListening = () => {
    if (!recognitionRef.current) {
      return;
    }

    recognitionRef.current.stop();
    setIsListening(false);
  };

  const handleClear = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    recognitionSessionRef.current.baseTranscript = '';
    recognitionSessionRef.current.finalTranscript = '';
    recognitionSessionRef.current.interimTranscript = '';
    setSpeechError('');
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
            onClick={handleStartListening}
            disabled={disabled || isSubmitting || isListening}
          >
            Start Recording
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={handleStopListening}
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
