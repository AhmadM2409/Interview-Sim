import { useEffect, useRef, useState } from 'react';

export const AudioPlayer = ({
  disabled,
  hasQuestionText,
  audioSrc,
  isLoading,
  errorMessage,
  onPlayRequested,
}) => {
  const audioRef = useRef(null);
  const [playbackNotice, setPlaybackNotice] = useState('');

  useEffect(() => {
    if (!audioSrc) {
      setPlaybackNotice('');
      return;
    }

    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    let playPromise;

    try {
      playPromise = audio.play?.();
    } catch (_error) {
      setPlaybackNotice('Audio is ready. Press play in the controls if your browser blocks autoplay.');
      return;
    }

    if (!playPromise?.catch) {
      setPlaybackNotice('');
      return;
    }

    playPromise
      .then(() => {
        setPlaybackNotice('');
      })
      .catch(() => {
        setPlaybackNotice('Audio is ready. Press play in the controls if your browser blocks autoplay.');
      });
  }, [audioSrc]);

  return (
    <section className="panel stack" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <p className="kicker" style={{ margin: 0 }}>
            Audio Delivery
          </p>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            ElevenLabs interviewer voice.
          </p>
        </div>

        <button
          type="button"
          className="button-secondary"
          onClick={onPlayRequested}
          disabled={disabled || !hasQuestionText || isLoading}
        >
          {isLoading ? 'Generating audio...' : 'Play Question Audio'}
        </button>
      </div>

      {errorMessage ? <div className="alert">{errorMessage}</div> : null}
      {playbackNotice ? <div className="alert warning">{playbackNotice}</div> : null}

      {audioSrc ? (
        <audio ref={audioRef} controls src={audioSrc}>
          Your browser does not support audio playback.
        </audio>
      ) : null}
    </section>
  );
};
