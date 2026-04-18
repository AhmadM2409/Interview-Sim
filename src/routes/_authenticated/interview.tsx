import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Mic, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createInterviewSession } from "@/lib/localData";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/interview")({
  head: () => ({
    meta: [{ title: "Voice Interview — AI Interview Simulator" }],
  }),
  component: InterviewSetupPage,
});

const ROLES = [
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full-stack Engineer",
  "Data Scientist",
  "Data Engineer",
  "Machine Learning Engineer",
  "DevOps / SRE",
  "Mobile Engineer",
  "Product Manager",
];

function InterviewSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string>("Software Engineer");
  const [creating, setCreating] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const startingRef = useRef(false);

  const startInterview = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    if (!user) {
      setStartError("Not signed in — please refresh and log in again.");
      return;
    }
    setStartError(null);
    setCreating(true);
    try {
      const session = createInterviewSession(user.id, role);
      await navigate({ to: "/interview/$sessionId", params: { sessionId: session.id } });
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start interview");
    } finally {
      setCreating(false);
      startingRef.current = false;
    }
  };

  return (
    <main className="container mx-auto max-w-2xl px-4 py-12">
      <div
        className="rounded-2xl border border-border/60 bg-card p-8"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div
          className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        >
          <Mic className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Start a voice interview</h1>
        <p className="mt-2 text-muted-foreground">
          Choose the role you're interviewing for. The AI will tailor questions and feedback.
        </p>

        <div className="mt-8 space-y-3">
          <label className="text-sm font-medium">Job role</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          size="lg"
          className="mt-8 w-full gap-2"
          onClick={startInterview}
          disabled={creating}
        >
          {creating ? "Starting..." : "Begin interview"}
          <ArrowRight className="h-4 w-4" />
        </Button>

        {startError && (
          <p className="mt-3 text-center text-sm text-destructive">{startError}</p>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          You'll need to allow microphone access.
        </p>
      </div>
      <Outlet />
    </main>
  );
}
