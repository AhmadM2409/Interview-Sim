import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, Mail } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AI Interview Simulator" },
      {
        name: "description",
        content: "Sign in or create an email account to start practicing interviews.",
      },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address");
const loginPasswordSchema = z.string().trim().min(1, "Enter your password");
const signUpNameSchema = z.string().trim().min(1, "Enter your name");
const signUpPasswordSchema = z.string().trim().min(4, "Use at least 4 characters");

function AuthPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, user, navigate]);

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
      setSubmitting(false);
    }
  };

  const validateLogin = () => {
    const parsedEmail = emailSchema.safeParse(loginEmail);
    if (!parsedEmail.success) {
      toast.error(parsedEmail.error.issues[0]?.message ?? "Invalid email");
      return null;
    }

    const parsedPassword = loginPasswordSchema.safeParse(loginPassword);
    if (!parsedPassword.success) {
      toast.error(parsedPassword.error.issues[0]?.message ?? "Invalid password");
      return null;
    }

    return {
      email: parsedEmail.data,
      password: parsedPassword.data,
    };
  };

  const validateCreateAccount = () => {
    const parsedName = signUpNameSchema.safeParse(signUpName);
    if (!parsedName.success) {
      toast.error(parsedName.error.issues[0]?.message ?? "Invalid name");
      return null;
    }

    const parsedEmail = emailSchema.safeParse(signUpEmail);
    if (!parsedEmail.success) {
      toast.error(parsedEmail.error.issues[0]?.message ?? "Invalid email");
      return null;
    }

    const parsedPassword = signUpPasswordSchema.safeParse(signUpPassword);
    if (!parsedPassword.success) {
      toast.error(parsedPassword.error.issues[0]?.message ?? "Invalid password");
      return null;
    }

    return {
      name: parsedName.data,
      email: parsedEmail.data,
      password: parsedPassword.data,
    };
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const values = validateLogin();
    if (!values) {
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(values.email, values.password);
      toast.success("Logged in successfully.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not log in");
      setSubmitting(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    const values = validateCreateAccount();
    if (!values) {
      return;
    }

    setSubmitting(true);
    try {
      await signUpWithEmail(values.name, values.email, values.password);
      toast.success("Account created and signed in.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create account");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <Link to="/" className="inline-flex items-center justify-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Brain className="h-6 w-6" />
          </span>
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to start practicing interviews and save your progress.
        </p>

        <Button
          onClick={handleGoogle}
          disabled={submitting}
          size="lg"
          variant="outline"
          className="mt-8 w-full gap-3"
        >
          <GoogleIcon />
          Log in with Google
        </Button>

        <div className="mt-6 text-left">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">{mode === "login" ? "Log in" : "Create account"}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              disabled={submitting}
              className="h-8 px-2 text-xs"
            >
              {mode === "login" ? "Create account" : "Back to log in"}
            </Button>
          </div>

          {mode === "login" ? (
            <form
              className="rounded-xl border border-border/70 bg-card/90 p-4"
              onSubmit={handleEmailLogin}
            >
              <p className="text-xs text-muted-foreground">Use your existing account.</p>

              <div className="mt-4 space-y-2 text-left">
                <Label htmlFor="login-email" className="text-sm">
                  Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="mt-3 space-y-2 text-left">
                <Label htmlFor="login-password" className="text-sm">
                  Password
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                size="lg"
                variant="outline"
                className="mt-4 w-full gap-2"
              >
                <Mail className="h-4 w-4" />
                {submitting ? "Please wait..." : "Log in"}
              </Button>
            </form>
          ) : (
            <form
              className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4"
              onSubmit={handleCreateAccount}
            >
              <p className="text-xs text-muted-foreground">
                Quick signup with name, email, and an easy password (like 1234).
              </p>

              <div className="mt-4 space-y-2 text-left">
                <Label htmlFor="signup-name" className="text-sm">
                  Name
                </Label>
                <Input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="mt-3 space-y-2 text-left">
                <Label htmlFor="signup-email" className="text-sm">
                  Email
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="mt-3 space-y-2 text-left">
                <Label htmlFor="signup-password" className="text-sm">
                  Password
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Try 1234 for quick testing"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <Button type="submit" disabled={submitting} size="lg" className="mt-4 w-full">
                {submitting ? "Creating..." : "Create account"}
              </Button>
              <p className="text-xs text-muted-foreground">
                New account creation signs in immediately in local mode.
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          By continuing you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
