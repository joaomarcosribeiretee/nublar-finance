import { useState } from "react";
import { useTranslation } from "react-i18next";
import { t } from "@/i18n";
import logo from "../../../../../assets/logo_semfundo.png";
import { Button } from "@/components/Button";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { sanitizeEmail } from "@/lib/input";
import { Segmented } from "@/components/Segmented";
import { getSupabase, supabaseConfigError } from "@/lib/supabase";

type Mode = "sign-in" | "sign-up";

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered")) return t("auth.errors.alreadyRegistered");
  if (lower.includes("email not confirmed")) return t("auth.errors.emailNotConfirmed");
  if (lower.includes("rate limit")) return t("auth.errors.rateLimit");
  if (lower.includes("password")) return t("auth.errors.weakPassword");
  if (lower.includes("fetch")) return t("auth.errors.offline");
  return message;
}

export function AuthScreen() {
  const { t } = useTranslation();
  const configError = supabaseConfigError();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setMessage({ text: t("auth.errors.invalidEmail"), tone: "error" });
      return;
    }
    if (password.length < 8) {
      setMessage({ text: t("auth.errors.shortPassword"), tone: "error" });
      return;
    }

    setPending(true);
    try {
      const supabase = getSupabase();
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setMessage({ text: translateAuthError(error.message), tone: "error" });
          return;
        }
        if (!data.session) {
          setMessage({ text: t("auth.signUpDone"), tone: "info" });
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({
          text: error.message.toLowerCase().includes("invalid")
            ? t("auth.errors.invalidCredentials")
            : translateAuthError(error.message),
          tone: "error",
        });
      }
    } catch (reason: unknown) {
      setMessage({
        text: translateAuthError(reason instanceof Error ? reason.message : t("auth.errors.signInFailed")),
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex h-full flex-col overflow-x-hidden overflow-y-auto">
      <div className="drag h-(--titlebar) shrink-0" />
      <div className="auth-glow pointer-events-none absolute inset-0" />

      <div className="auth-layout animate-enter">
        <div className="auth-story">
          <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-20 w-20 object-contain" />
          <span className="font-display text-3xl tracking-tight">{t("common.appName")}</span>
          </div>
          <p className="design-eyebrow mt-10">{t("auth.story.eyebrow")}</p>
          <h1 className="auth-headline">{t("auth.story.headline")}<br />{t("auth.story.headlineSecond")}</h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-muted">
            {t("auth.story.intro")}
          </p>
          <div className="auth-features">
            <span><Icon name="bank" size={19} /> {t("auth.story.accounts")}</span>
            <span><Icon name="chart" size={19} /> {t("auth.story.spending")}</span>
            <span><Icon name="target" size={19} /> {t("auth.story.plans")}</span>
          </div>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="auth-form space-y-5"
        >
          <div className="mb-7">
            <h2 className="font-display text-3xl">{mode === "sign-in" ? t("auth.signIn.title") : t("auth.signUp.title")}</h2>
            <p className="mt-2 text-sm text-muted">{mode === "sign-in" ? t("auth.signIn.subtitle") : t("auth.signUp.subtitle")}</p>
          </div>
          <div className="flex">
            <Segmented
              full
              label={t("auth.mode")}
              value={mode}
              options={[
                { value: "sign-in", label: t("auth.signIn.action") },
                { value: "sign-up", label: t("auth.signUp.action") },
              ]}
              onChange={(next) => {
                setMode(next);
                setMessage(null);
              }}
            />
          </div>
          <Field label={t("auth.email")}>
            <input
              className={controlClass}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(sanitizeEmail(event.target.value))}
              required
            />
          </Field>
          <Field label={t("auth.password")}>
            <span className="relative block">
              <input
                className={`${controlClass} pr-11`}
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                placeholder={mode === "sign-up" ? t("auth.passwordHint") : ""}
                maxLength={72}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                aria-pressed={showPassword}
                className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-faint transition-colors hover:text-foreground"
                onClick={() => setShowPassword((value) => !value)}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
              </button>
            </span>
          </Field>
          {configError ? <p className="text-sm text-accent">{configError}</p> : null}
          {message ? (
            <p
              role={message.tone === "error" ? "alert" : "status"}
              className={`animate-enter text-sm ${message.tone === "error" ? "text-negative" : "text-positive"}`}
            >
              {message.text}
            </p>
          ) : null}
          <Button
            variant="primary"
            type="submit"
            className="w-full"
            disabled={pending || Boolean(configError)}
          >
            {pending ? t("auth.wait") : mode === "sign-in" ? t("auth.signIn.action") : t("auth.signUp.action")}
          </Button>
        </form>
      </div>
    </main>
  );
}
