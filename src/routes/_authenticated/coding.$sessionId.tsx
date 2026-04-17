import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Code2, ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coding/$sessionId")({
  head: () => ({
    meta: [{ title: "Coding session — AI Interview Simulator" }],
  }),
  component: CodingSessionPage,
});

type Session = {
  id: string;
  problem_title: string;
  problem_description: string | null;
  language: string;
  final_code: string | null;
};

function CodingSessionPage() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("coding_sessions")
      .select("id, problem_title, problem_description, language, final_code")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        setSession(data);
        setCode(data?.final_code ?? "// Write your solution here\n\n");
      });
  }, [sessionId]);

  const saveDraft = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("coding_sessions")
      .update({ final_code: code })
      .eq("id", sessionId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Draft saved");
    }
  };

  if (!session) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <Link
        to="/coding"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Problem panel */}
        <aside
          className="rounded-2xl border border-border/60 bg-card p-6"
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Code2 className="h-4 w-4" />
            Problem
          </div>
          <h1 className="mt-2 text-xl font-semibold">{session.problem_title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {session.problem_description}
          </p>
          <div className="mt-6 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              AI feedback
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Live AI feedback hooks up next — it will analyze your code as you type and surface
              syntax issues and improvements here.
            </p>
          </div>
        </aside>

        {/* Editor panel */}
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-[oklch(0.18_0.03_270)] text-[oklch(0.95_0.02_270)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/5 bg-black/30 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-white/60">
                solution.{extensionFor(session.language)}
              </span>
            </div>
            <Button size="sm" variant="secondary" onClick={saveDraft} disabled={saving}>
              {saving ? "Saving..." : "Save draft"}
            </Button>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="block min-h-[60vh] w-full resize-none bg-transparent p-5 font-mono text-sm leading-relaxed text-white/90 outline-none"
            placeholder="// Start coding..."
          />
        </section>
      </div>
    </main>
  );
}

function extensionFor(lang: string) {
  switch (lang) {
    case "typescript":
      return "ts";
    case "python":
      return "py";
    case "java":
      return "java";
    case "cpp":
      return "cpp";
    case "go":
      return "go";
    default:
      return "js";
  }
}
