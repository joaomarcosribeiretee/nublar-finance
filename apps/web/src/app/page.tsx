import Image from "next/image";
import { healthLabel } from "@/lib/health";
import { fetchServiceHealth } from "@/services/health";

const questions = [
  "Onde estou?",
  "Para onde meu dinheiro está indo?",
  "Para onde minhas finanças estão caminhando?",
];

export default async function HomePage() {
  const health = await fetchServiceHealth();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(47,122,82,0.35),transparent_42%),radial-gradient(circle_at_80%_20%,rgba(198,161,91,0.16),transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <Image
          src="/logo.png"
          alt="Logo do Nublar"
          width={220}
          height={220}
          priority
          className="h-auto w-44 sm:w-56"
        />
        <p className="mt-2 text-xs tracking-[0.38em] text-gold uppercase">
          Patrimônio
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-6xl font-medium tracking-tight sm:text-7xl">
          Nublar
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Informações financeiras complexas, em uma visão simples da evolução
          do seu patrimônio.
        </p>
        <ul className="mt-10 flex w-full flex-col gap-3 sm:flex-row">
          {questions.map((question) => (
            <li
              key={question}
              className="flex-1 rounded-2xl border border-[var(--line)] bg-white/5 px-4 py-5 text-sm text-foreground"
            >
              {question}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-muted">{healthLabel(health)}</p>
      </div>
    </main>
  );
}
