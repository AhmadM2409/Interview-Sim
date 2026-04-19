import { useEffect, useMemo, useRef, useState } from 'react';

const getSpeechRecognitionCtor = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const useSpeechTranscription = ({ value, onChange }) => {
  const recognitionRef = useRef(null);
  const transcriptRef = useRef(value);
  const onChangeRef = useRef(onChange);
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
    transcriptRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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

      onChangeRef.current(nextTranscript);
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
  }, [speechCtor]);

  const startListening = ({ disabled, isSubmitting }) => {
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

  const stopListening = () => {
    if (!recognitionRef.current) {
      return;
    }

    recognitionRef.current.stop();
    setIsListening(false);
  };

  const resetRecognitionState = () => {
    recognitionSessionRef.current.baseTranscript = '';
    recognitionSessionRef.current.finalTranscript = '';
    recognitionSessionRef.current.interimTranscript = '';
    setSpeechError('');
  };

  return {
    isListening,
    speechError,
    isSpeechSupported,
    startListening,
    stopListening,
    resetRecognitionState,
  };
};
