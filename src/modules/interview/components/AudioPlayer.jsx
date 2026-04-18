export const AudioPlayer = ({ text, disabled }) => {
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const handlePlay = () => {
    if (!canSpeak || !text) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section className="panel row" style={{ justifyContent: 'space-between' }}>
      <div>
        <p className="kicker" style={{ margin: 0 }}>
          Audio Delivery
        </p>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Browser speech synthesis {canSpeak ? 'available' : 'not available in this environment'}.
        </p>
      </div>
      <button type="button" className="button-secondary" onClick={handlePlay} disabled={disabled || !text || !canSpeak}>
        Play Question Audio
      </button>
    </section>
  );
};
