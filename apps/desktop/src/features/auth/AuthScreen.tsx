import { useState } from "react";
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
  if (lower.includes("already registered")) return "Esse email já tem conta. Entre com ele.";
  if (lower.includes("email not confirmed")) return "Confirme o email antes de entrar.";
  if (lower.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco.";
  if (lower.includes("password")) return "Senha fraca. Use pelo menos 8 caracteres.";
  if (lower.includes("fetch")) return "Sem conexão com o Supabase.";
  return message;
}

export function AuthScreen() {
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
      setMessage({ text: "Digite um email válido, como nome@exemplo.com.", tone: "error" });
      return;
    }
    if (password.length < 8) {
      setMessage({ text: "A senha precisa ter pelo menos 8 caracteres.", tone: "error" });
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
          setMessage({ text: "Conta criada. Confirme o email para entrar.", tone: "info" });
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({
          text: error.message.toLowerCase().includes("invalid")
            ? "Email ou senha incorretos."
            : translateAuthError(error.message),
          tone: "error",
        });
      }
    } catch (reason: unknown) {
      setMessage({
        text: translateAuthError(reason instanceof Error ? reason.message : "Falha ao entrar"),
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
          <span className="font-display text-3xl tracking-tight">Nublar</span>
          </div>
          <p className="design-eyebrow mt-10">Seu dinheiro, com clareza</p>
          <h1 className="auth-headline">Mais visão.<br />Mais tranquilidade.</h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-muted">
            Entenda o presente e planeje o que vem pela frente.
            Sua vida financeira, em um só lugar.
          </p>
          <div className="auth-features">
            <span><Icon name="bank" size={19} /> Contas reunidas</span>
            <span><Icon name="chart" size={19} /> Gastos à vista</span>
            <span><Icon name="target" size={19} /> Planos no caminho</span>
          </div>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="auth-form space-y-5"
        >
          <div className="mb-7">
            <h2 className="font-display text-3xl">{mode === "sign-in" ? "Bom ter você aqui." : "Seu próximo começo."}</h2>
            <p className="mt-2 text-sm text-muted">{mode === "sign-in" ? "Entre para cuidar dos seus planos." : "Crie sua conta e organize suas finanças."}</p>
          </div>
          <div className="flex">
            <Segmented
              full
              label="Entrar ou criar conta"
              value={mode}
              options={[
                { value: "sign-in", label: "Entrar" },
                { value: "sign-up", label: "Criar conta" },
              ]}
              onChange={(next) => {
                setMode(next);
                setMessage(null);
              }}
            />
          </div>
          <Field label="Email">
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
          <Field label="Senha">
            <span className="relative block">
              <input
                className={`${controlClass} pr-11`}
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                placeholder={mode === "sign-up" ? "Mínimo 8 caracteres" : ""}
                maxLength={72}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
            {pending ? "Aguarde…" : mode === "sign-in" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
      </div>
    </main>
  );
}
