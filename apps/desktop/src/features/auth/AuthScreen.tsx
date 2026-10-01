import { useState } from "react";
import logo from "../../../../../assets/logo_semfundo.png";
import { Button } from "@/components/Button";
import { controlClass, Field } from "@/components/Field";
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
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
    <main className="relative flex h-full flex-col overflow-hidden">
      <div className="drag h-[var(--titlebar)] shrink-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(76,150,108,0.22),transparent_55%),radial-gradient(circle_at_85%_15%,rgba(201,164,92,0.08),transparent_35%)]" />

      <div className="animate-enter relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pb-16">
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="" className="h-20 w-20 object-contain" />
          <h1 className="mt-4 font-display text-4xl tracking-tight">Nublar</h1>
          <p className="mt-2 text-sm text-muted">
            Onde estou, para onde vai meu dinheiro
            <br />e para onde minhas finanças caminham.
          </p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="mt-10 space-y-4 rounded-3xl border border-line bg-surface/80 p-6 shadow-2xl shadow-black/30 backdrop-blur"
        >
          <div className="flex">
            <Segmented
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
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Senha">
            <input
              className={controlClass}
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              placeholder={mode === "sign-up" ? "Mínimo 8 caracteres" : ""}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          {configError ? <p className="text-sm text-gold">{configError}</p> : null}
          {message ? (
            <p
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
