import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Code2, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coding")({
  head: () => ({
    meta: [{ title: "Coding Practice — AI Interview Simulator" }],
  }),
  component: CodingSetupPage,
});

const PROBLEMS = [
  {
    title: "Two Sum",
    description:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
  },
  {
    title: "Valid Parentheses",
    description:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
  },
  {
    title: "Reverse Linked List",
    description: "Given the head of a singly linked list, reverse the list, and return the reversed list.",
  },
  {
    title: "Maximum Subarray",
    description:
      "Given an integer array nums, find the contiguous subarray with the largest sum, and return its sum.",
  },
];

const LANGUAGES = ["javascript", "typescript", "python", "java", "cpp", "go"];

function CodingSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [problemIdx, setProblemIdx] = useState("0");
  const [language, setLanguage] = useState("javascript");
  const [creating, setCreating] = useState(false);

  const startSession = async () => {
    if (!user) return;
    const problem = PROBLEMS[Number(problemIdx)];
    setCreating(true);
    const { data, error } = await supabase
      .from("coding_sessions")
      .insert({
        user_id: user.id,
        problem_title: problem.title,
        problem_description: problem.description,
        language,
        status: "in_progress",
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not start session");
      return;
    }
    navigate({ to: "/coding/$sessionId", params: { sessionId: data.id } });
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
          <Code2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Start coding practice</h1>
        <p className="mt-2 text-muted-foreground">
          Pick a problem and language. The AI will give you live feedback as you type.
        </p>

        <div className="mt-8 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Problem</label>
            <Select value={problemIdx} onValueChange={setProblemIdx}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROBLEMS.map((p, i) => (
                  <SelectItem key={p.title} value={String(i)}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          size="lg"
          className="mt-8 w-full gap-2"
          onClick={startSession}
          disabled={creating}
        >
          {creating ? "Starting..." : "Open editor"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}
