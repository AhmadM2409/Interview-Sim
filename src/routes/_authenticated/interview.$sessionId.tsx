import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Construction, ArrowLeft, Loader2, CheckCircle, RotateCcw } from "lucide-react";
import { getInterviewSessionById } from "@/lib/localData";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useInterviewEngine } from "@/features/interview/hooks/useInterviewEngine";

export const Route = createFileRoute("/_authenticated/interview/$sessionId")({
  head: () => ({
    meta: [{ title: "Interview in progress — AI Interview Simulator" }],
  }),
  component: InterviewSessionPage,
});

type Session = {
  id: string;
  job_role: string;
  status: string;
};

function InterviewSessionPage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = getInterviewSessionById(sessionId);
    setSession(
      data
        ? {
            id: data.id,
            job_role: data.job_role,
            status: data.status,
          }
        : null,
    );
    setLoading(false);
  }, [sessionId]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  // Engine is only active when session + user are present
  if (!session || !user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Session not found.</p>
      </main>
    );
  }

  return (
    <InterviewEngine
      sessionId={sessionId}
      jobRole={session.job_role}
      userId={user.id}
    />
  );
}

// ── Engine view — consumes useInterviewEngine exclusively ─────────────────────

interface EngineProps {
  sessionId: string;
  jobRole: string;
  userId: string;
}

function InterviewEngine({ sessionId, jobRole, userId }: EngineProps) {
  const { state, startInterview, continueFromDegraded, restartFromError, startRecording, stopRecording, confirmTranscript, retryAnswer, audioRef } =
    useInterviewEngine({ sessionId, jobRole, userId });

  // Hidden audio element for TTS playback
  const audioEl = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    // Wire the audio element to the engine's ref
    (audioRef as React.MutableRefObject<HTMLAudioElement | null>).current = audioEl.current;
  }, [audioRef]);

  const { phase, currentQuestionText, transcriptPreview, isRecording, isDegraded, error, finalScore, summaryFeedback, scores, currentQuestionIndex, totalQuestions } = state;

  const micEnabled = phase === "AWAITING_MIC";
  const stopEnabled = phase === "RECORDING";
  const isProcessing = ["FETCHING_CONTEXT", "PROCESSING_STT", "EVALUATING", "COMPLETING"].includes(phase);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <audio ref={audioEl} className="hidden" />

      <Link
        to="/interview"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div
        className="mt-6 rounded-2xl border border-border/60 bg-card p-8"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Mic className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{jobRole} interview</h1>
            <p className="text-xs text-muted-foreground">Session {sessionId.slice(0, 8)}</p>
          </div>
          {isDegraded && (
            <span className="ml-auto rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
              degraded mode
            </span>
          )}
        </div>

        {/* ── IDLE: start button ── */}
        {phase === "IDLE" && (
          <div className="mt-8 text-center">
            <Button onClick={startInterview} className="mt-2">
              Begin Interview
            </Button>
          </div>
        )}

        {/* ── Processing spinner ── */}
        {isProcessing && (
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">
              {phase === "FETCHING_CONTEXT" && "Preparing your questions…"}
              {phase === "PROCESSING_STT" && "Transcribing your answer…"}
              {phase === "EVALUATING" && "Evaluating your answer…"}
              {phase === "COMPLETING" && "Generating final report…"}
            </span>
          </div>
        )}

        {/* ── Question + mic controls ── */}
        {(phase === "PLAYING_AUDIO" || phase === "AWAITING_MIC" || phase === "RECORDING") && (
          <div className="mt-8 space-y-6">
            {totalQuestions > 0 && (
              <p className="text-xs text-muted-foreground">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </p>
            )}
            {currentQuestionText && (
              <p className="text-base font-medium leading-relaxed">{currentQuestionText}</p>
            )}
            <div className="flex items-center gap-3">
              <Button
                onClick={startRecording}
                disabled={!micEnabled}
                variant={isRecording ? "destructive" : "default"}
              >
                <Mic className="mr-2 h-4 w-4" />
                {isRecording ? "Recording…" : "Connect microphone"}
              </Button>
              {isRecording && (
                <Button variant="outline" onClick={stopRecording}>
                  Stop recording
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Transcript review ── */}
        {phase === "REVIEWING_TRANSCRIPT" && transcriptPreview && (
          <div className="mt-8 space-y-4">
            {currentQuestionText && (
              <p className="text-sm text-muted-foreground">{currentQuestionText}</p>
            )}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Your answer</p>
              <p className="text-sm leading-relaxed">{transcriptPreview}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={confirmTranscript}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Submit answer
              </Button>
              <Button variant="outline" onClick={retryAnswer}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Re-record
              </Button>
            </div>
          </div>
        )}

        {/* ── Finished / results ── */}
        {phase === "FINISHED" && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <h2 className="text-lg font-semibold">Interview complete</h2>
            </div>
            {finalScore !== null && (
              <p className="text-3xl font-bold">
                {finalScore.toFixed(1)}<span className="text-lg font-normal text-muted-foreground">/10</span>
              </p>
            )}
            {summaryFeedback && (
              <p className="text-sm leading-relaxed text-muted-foreground">{summaryFeedback}</p>
            )}
            {scores.length > 0 && (
              <div className="space-y-2">
                {scores.map((s) => (
                  <div key={s.index} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                    <span className="font-medium">Q{s.index + 1}</span>
                    <span className="ml-2 text-muted-foreground">{s.score}/10 — {s.feedback}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Error state ── */}
        {phase === "ERROR" && error && (
          <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button variant="outline" className="mt-3" onClick={restartFromError}>
              Retry
            </Button>
          </div>
        )}

        {/* ── Degraded banner — user confirms before interview starts ── */}
        {phase === "DEGRADED" && (
          <div className="mt-8 rounded-xl border border-yellow-300/40 bg-yellow-50/20 p-4">
            <p className="text-sm text-yellow-800">
              Running in degraded mode — context search unavailable, using generic questions.
            </p>
            <Button className="mt-3" onClick={continueFromDegraded}>
              Continue anyway
            </Button>
          </div>
        )}

        {/* ── PLAYING_AUDIO fallback text ── */}
        {phase === "PLAYING_AUDIO" && (
          <p className="mt-3 text-xs text-muted-foreground">Playing question audio…</p>
        )}

        {/* ── Construction placeholder shown only before engine starts ── */}
        {phase === "IDLE" && (
          <div className="mt-6 rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 text-center">
            <Construction className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-semibold">Ready to begin</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Click "Begin Interview" to generate role-specific questions and start your voice interview.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
