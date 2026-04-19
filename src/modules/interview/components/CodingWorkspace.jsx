import Editor from '@monaco-editor/react';

export const CodingWorkspace = ({
  code,
  language = 'javascript',
  output,
  disabled,
  isSubmitting,
  onCodeChange,
  onRun,
  onSubmit,
  onClear,
}) => (
  <section className="panel stack">
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p className="kicker" style={{ margin: 0 }}>
          Coding Workspace
        </p>
        <strong>{language}</strong>
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
        <strong>Output Console</strong>
        <span className="badge">MVP Runner</span>
      </div>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', minHeight: 72 }}>
        {output || 'Run your code to inspect output before submitting.'}
      </pre>
    </section>

    <section className="row">
      <button type="button" className="button-secondary" onClick={onRun} disabled={disabled}>
        Run Code
      </button>
      <button type="button" className="button-secondary" onClick={onClear} disabled={disabled}>
        Reset Code
      </button>
      <button type="button" onClick={onSubmit} disabled={disabled}>
        {isSubmitting ? 'Submitting code...' : 'Submit Code'}
      </button>
    </section>
  </section>
);
