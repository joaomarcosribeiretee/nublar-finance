# Técnico

Arquitetura, stack, como executar e regras de implementação. O que o Nublar é para quem usa está no [README](../README.md).

---

# Como executar

Requisitos:

- Node.js 20 ou superior
- pnpm 10
- Um projeto no Supabase

```bash
pnpm install
pnpm --filter @nublar/api db:migrate
pnpm dev
```

Antes de `pnpm dev`, preencha `apps/api/.env` e `apps/desktop/.env`:

- `DATABASE_URL`: Supabase → Project Settings → Database → Connection string → URI. Use a conexão direta na porta `5432`.
- `SUPABASE_ANON_KEY` (API) e `VITE_SUPABASE_ANON_KEY` (desktop): a mesma publishable key, em Project Settings → API.

`.env` só é lido quando a API sobe: depois de alterá-lo, reinicie `pnpm dev`.

Atalho no app: `N` abre um novo lançamento de qualquer tela.

- O app abre numa janela desktop
- API: http://localhost:3333/health

Logos e imagens ficam em `assets/`, não na raiz do repositório. O exemplo de ambiente está em `apps/api/.env.example`.

---

# Modelo

Tipos de conta:

```text
CHECKING
SAVINGS
CASH
BROKERAGE
CRYPTO
OTHER
```

Tipos de lançamento:

```text
INCOME
EXPENSE
TRANSFER
INVESTMENT
```

Uma transação pode possuir:

```text
id
userId
accountId
categoryId
type
amount
currency
description
date
source
status
createdAt
updatedAt
```

Origens:

```text
MANUAL
CSV_IMPORT
OFX_IMPORT
OPEN_FINANCE
```

O uso inicial é `MANUAL`. Novas origens entram sem reescrever o domínio.

Classes de investimento:

```text
FIXED_INCOME
STOCK
FII
ETF
CRYPTO
OTHER
```

Transferência entre contas do mesmo usuário não é receita nem despesa e não altera o patrimônio. Investimento não é gasto de consumo: é movimentação patrimonial. Análises separam os dois.

Analytics consome regras e dados do backend. Regra financeira crítica não vive só no frontend.

---

# Arquitetura

Modular monolith. Sem microserviço prematuro.

A arquitetura favorece modularidade, baixo acoplamento, testabilidade, manutenção, crescimento gradual e a possibilidade de extrair um serviço depois, se um dia fizer sentido.

```text
Desktop
 │
 ▼
REST API
 │
 ▼
Application / Domain
 │
 ▼
Repositories
 │
 ▼
Supabase (PostgreSQL)
```

No futuro, desktop, mobile e integrações conversam com a mesma API.

O backend é a fonte da verdade das regras financeiras.

---

# Stack

Monorepo com pnpm e Turborepo.

Frontend: Electron, React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod, Recharts.

Backend: Node.js, NestJS, TypeScript, Prisma, Supabase (PostgreSQL).

Infraestrutura: Supabase e GitHub Actions.

Testes: Vitest, Testing Library, Jest, Playwright.

Redis só se aparecer uma necessidade real.

---

# Estrutura do monorepo

```text
nublar/

apps/
├── desktop/
│   └── Electron + React
│
├── api/
│   └── NestJS
│
└── mobile/
    └── React Native (futuro)

assets/
└── logo.png

packages/
├── types/
├── validation/
├── eslint-config/
└── tsconfig/

docs/
├── tecnico.md
└── decisions/

package.json
pnpm-workspace.yaml
turbo.json
README.md
```

---

# Backend

```text
apps/api/src/

auth/
users/
accounts/
transactions/
categories/
cards/
recurring/
investments/
planning/
analytics/
imports/
institutions/
ledger/
```

Um módulo só ganha `domain`, `application`, `infrastructure` e `presentation` quando isso resolver um problema real. Enquanto isso, a separação fica simples: controller fino, regra no serviço, cálculo no ledger.

---

# Frontend

```text
apps/desktop/src/

components/
features/
hooks/
lib/
services/
types/
```

O que é de uma tela fica na feature. `components` guarda o que mais de uma tela usa.

---

# Valores monetários

Nunca persistir dinheiro como float.

```text
R$ 1.234,56
↓
123456 centavos
```

```text
amount: bigint
currency: BRL
```

Formatação só na borda, na hora de mostrar.

---

# Segurança

- Senha não fica no banco da aplicação. O login é do Supabase Auth.
- Nunca registrar senha ou token em log.
- Secret não entra no Git. Ambiente fica em variável.
- Input é validado no backend.
- Endpoint privado exige o usuário autenticado.
- Toda consulta privada filtra pelo id desse usuário, nunca por um id enviado pelo cliente.
- Recurso de outra pessoa responde como não encontrado.
- Dado sensível não sai na resposta sem necessidade.

---

# Open Finance

Fora do que existe hoje. A origem `OPEN_FINANCE` existe para o dia em que entrar.

Integração bancária não usa senha de banco digitada pelo usuário. Quando existir, usa o mecanismo oficial.

---

# Importação

CSV e OFX, antes de Open Finance.

```text
Upload
  ↓
Parsing
  ↓
Normalização
  ↓
Detecção de duplicados
  ↓
Categorização
  ↓
Revisão
  ↓
Importação
```

Uma regra pode aprender que "UBER" é transporte e "SPOTIFY" é assinatura.

---

# Regras para agentes

Cursor, Claude e os outros agentes neste repositório:

1. Não mudar a arquitetura sem deixar o motivo escrito.
2. Não instalar dependência se o que já existe resolve.
3. Não duplicar regra financeira. O lugar dela é o backend.
4. Controller recebe, valida o básico, chama o serviço e devolve. Regra de negócio não mora nele.
5. Dinheiro não é float.
6. Transferência entre contas próprias não é despesa nem receita.
7. Aporte não é consumo.
8. O frontend não é fonte de autorização nem de regra.
9. TypeScript de verdade. Sem `any`.
10. Módulos independentes, sem ciclo.
11. Só o que a tarefa pede. Sem microserviço, Kafka, Kubernetes, event sourcing ou CQRS enquanto não houver um problema que eles resolvam.
12. Cálculo, parcela, transferência, recorrência e projeção têm teste.

Antes de implementar: ler o README e este arquivo, achar o módulo, entender a regra, ver o que já existe, evitar duplicar, implementar, rodar lint, typecheck e os testes do que mudou, e dizer o que mudou.

Regra financeira que não está escrita não se inventa. Se a ambiguidade mudar dinheiro, perguntar antes.

Decisões já tomadas:

- [Compromissos](decisions/0001-regras-de-compromissos.md)
- [Investimentos e análises](decisions/0002-investimentos-e-analises.md)
- [Planejamento e importação](decisions/0003-planejamento-e-importacao.md)

---

# Roadmap

## Fase 0 — Fundação

Monorepo, Electron, NestJS, Supabase, Prisma, ambiente, lint, typecheck, testes e CI.

## Fase 1 — Core financeiro

Usuário, autenticação, contas, categorias, receitas, despesas, transferências e histórico.

## Fase 2 — Compromissos

Cartões, faturas, compras, parcelamentos e recorrências. Regras em `docs/decisions/0001-regras-de-compromissos.md`.

## Fase 3 — Dashboard

Patrimônio, saldo, receitas, despesas, investimentos, faturas, próximos compromissos, gráficos e comparação entre meses. Regras em `docs/decisions/0002-investimentos-e-analises.md`.

## Fase 4 — Investimentos

Renda fixa, ações, FIIs, ETFs, cripto, distribuição e rentabilidade. Cotação automática fica para depois.

## Fase 5 — Planejamento

Metas, orçamentos, calendário e projeção. Regras em `docs/decisions/0003-planejamento-e-importacao.md`.

## Fase 6 — Automação

Importação OFX/CSV, duplicados e categorização aprendida.

## Depois

Open Finance, app mobile, sincronização bancária, cotações automáticas, notificações e insights.
