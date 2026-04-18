import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, Mail, Phone } from "lucide-react";
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
        content: "Sign in with Google or your phone number to start practicing interviews.",
      },
    ],
  }),
  component: AuthPage,
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Use international format, e.g. +14155552671");
const emailSchema = z.string().trim().email("Enter a valid email address");
const passwordSchema = z.string().trim().min(6, "Use at least 6 characters for the password");
const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, "Enter the code from your text message");

function AuthPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signInWithPhone, verifyPhoneOtp } =
    useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

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
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
      setSubmitting(false);
    }
  };

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      toast.error(parsedEmail.error.issues[0]?.message ?? "Invalid email");
      return;
    }

    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      toast.error(parsedPassword.error.issues[0]?.message ?? "Invalid password");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(parsedEmail.data, parsedPassword.data);
      toast.success("Signed in successfully.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign in");
      setSubmitting(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid phone number");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithPhone(parsed.data);
      setPhone(parsed.data);
      setOtpSent(true);
      toast.success("Code sent! Check your messages.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = otpSchema.safeParse(otp);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid code");
      return;
    }
    setSubmitting(true);
    try {
      await verifyPhoneOtp(phone, parsed.data);
      // navigation handled by effect once session updates
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
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
          Continue with Google
        </Button>

        <div className="mt-6 rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-left">
          <p className="text-sm font-medium">Testing login</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use email and password to sign in or create an account automatically for testing.
          </p>

          <form onSubmit={handleEmailPassword} className="mt-4 space-y-3">
            <div className="space-y-2 text-left">
              <Label htmlFor="email" className="text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="password" className="text-sm">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            <Button type="submit" disabled={submitting} size="lg" className="w-full gap-2">
              <Mail className="h-4 w-4" />
              {submitting ? "Signing in..." : "Continue with email"}
            </Button>
          </form>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          OR
          <span className="h-px flex-1 bg-border" />
        </div>

        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-3 text-left">
            <Label htmlFor="phone" className="text-sm">
              Phone number
            </Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+14155552671"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={16}
              disabled={submitting}
            />
            <Button type="submit" disabled={submitting} size="lg" className="w-full gap-2">
              <Phone className="h-4 w-4" />
              {submitting ? "Sending..." : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3 text-left">
            <Label htmlFor="otp" className="text-sm">
              Verification code
            </Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              maxLength={8}
              disabled={submitting}
            />
            <Button type="submit" disabled={submitting} size="lg" className="w-full">
              {submitting ? "Verifying..." : "Verify & sign in"}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setOtp("");
                setOtpSent(false);
              }}
              disabled={submitting}
            >
              Use a different number
            </button>
          </form>
        )}

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
