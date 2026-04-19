import { useSpeechTranscription } from '../hooks/useSpeechTranscription.js';

import Editor from '@monaco-editor/react';

export const CodingEditor = ({
  code,
  language = 'javascript',
  languageOptions = [],
  output,
  transcript,
  assistantFeedback,
  assistantError,
  assistantAudioSrc,
  disabled,
  isSubmitting,
  isAssistantPending,
  shouldSpeakAssistant,
  onCodeChange,
  onRun,
  onSubmit,
  onClearCode,
  onTranscriptChange,
  onClearTranscript,
  onLanguageChange,
  onRequestAssistant,
  onToggleAssistantVoice,
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
    onChange: onTranscriptChange,
  });

  const handleClearTranscript = () => {
    stopListening();
    resetRecognitionState();
    onClearTranscript();
  };

  const normalizedLanguageOptions = languageOptions.length > 0 ? languageOptions : ['javascript'];

  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="stack" style={{ gap: 6 }}>
          <div>
            <p className="kicker" style={{ margin: 0 }}>
              Coding Environment
            </p>
            <strong>{language}</strong>
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="kicker" style={{ margin: 0 }}>
              Language
            </span>
            <select value={language} onChange={(event) => onLanguageChange(event.target.value)} disabled={disabled}>
              {normalizedLanguageOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'cpp'
                    ? 'C++'
                    : option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="badge">Editor</span>
      </div>

      <Editor
        height="320px"
        defaultLanguage={language}
        language={language}
        theme="vs-dark"
        value={code}
        onChange={(value) => onCodeChange(value ?? '')}
        onMount={(editor) => editor.focus()}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          readOnly: disabled,
        }}
      />

      <section className="panel stack" style={{ background: '#10161f', color: '#e5edf7' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Console Output</strong>
          <span className="badge">MVP Runner</span>
        </div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', minHeight: 72 }}>
          {output || 'Run your code to inspect output before confirming your answer.'}
        </pre>
      </section>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="kicker" style={{ margin: 0 }}>
              Spoken Reasoning
            </p>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Talk through your approach while you code. The transcript is sent with your final coding answer.
            </p>
          </div>
          <label className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={shouldSpeakAssistant}
              onChange={(event) => onToggleAssistantVoice(event.target.checked)}
              disabled={disabled}
            />
            <span className="muted">Voice replies</span>
          </label>
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
            Microphone input is not available in this browser. You can keep the reasoning transcript updated manually.
          </p>
        )}

        {speechError ? <div className="alert warning">{speechError}</div> : null}

        <label>
          Reasoning transcript
          <textarea
            value={transcript}
            onChange={(event) => onTranscriptChange(event.target.value)}
            placeholder="Explain what you are trying, the edge cases you are thinking about, and what you would do next..."
            disabled={disabled}
          />
        </label>

        <div className="row">
          <button
            type="button"
            className="button-secondary"
            onClick={() => onRequestAssistant(true)}
            disabled={disabled || isAssistantPending || (!transcript.trim() && !code.trim())}
          >
            {isAssistantPending ? 'Checking reasoning...' : 'Check My Reasoning'}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={handleClearTranscript}
            disabled={disabled || isSubmitting}
          >
            Clear Reasoning
          </button>
        </div>

        {assistantError ? <div className="alert">{assistantError}</div> : null}

        {assistantFeedback ? (
          <section className="panel stack" style={{ background: '#f8fbff' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Live Interviewer Feedback</strong>
              <span className="badge">{isAssistantPending ? 'Updating' : 'Ready'}</span>
            </div>
            <p style={{ margin: 0 }}>{assistantFeedback.responseText}</p>
            {assistantFeedback.goodSignals?.length ? (
              <p style={{ margin: 0 }}>
                <strong>Good:</strong> {assistantFeedback.goodSignals.join(' ')}
              </p>
            ) : null}
            {assistantFeedback.missingOrRisky?.length ? (
              <p style={{ margin: 0 }}>
                <strong>Missing:</strong> {assistantFeedback.missingOrRisky.join(' ')}
              </p>
            ) : null}
            {assistantFeedback.questionableAssumptions?.length ? (
              <p style={{ margin: 0 }}>
                <strong>Questionable:</strong> {assistantFeedback.questionableAssumptions.join(' ')}
              </p>
            ) : null}
            <p style={{ margin: 0 }}>
              <strong>Suggested next step:</strong> {assistantFeedback.suggestedNextStep}
            </p>
            {assistantAudioSrc ? (
              <audio controls src={assistantAudioSrc}>
                Your browser does not support audio playback.
              </audio>
            ) : null}
          </section>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            The coding interviewer will react to your reasoning after pauses, and you can also request feedback at any time.
          </p>
        )}
      </section>

      <section className="row">
        <button type="button" className="button-secondary" onClick={onRun} disabled={disabled}>
          Run Code
        </button>
        <button type="button" className="button-secondary" onClick={onClearCode} disabled={disabled}>
          Reset Code
        </button>
        <button type="button" onClick={onSubmit} disabled={disabled}>
          {isSubmitting ? 'Confirming answer...' : 'Confirm Answer'}
        </button>
      </section>
    </section>
  );
};
