# 🦖 Nublar

**Nublar** é uma plataforma pessoal de organização e acompanhamento financeiro, criada para centralizar toda a vida financeira do usuário de maneira simples, visual e didática.

A proposta é permitir que o usuário entenda rapidamente:

- quanto possui;
- quanto recebe;
- quanto gasta;
- quanto está comprometido nos próximos meses;
- quanto possui investido;
- como seus investimentos estão distribuídos;
- como seu patrimônio está evoluindo;
- quais são seus próximos compromissos financeiros.

O projeto começa como uma aplicação **Web/Desktop para uso pessoal**, mas sua arquitetura deve permitir evolução futura para mobile e integrações externas sem reescrever o core financeiro.

---

# 🚀 Como executar

A Fase 0 sobe a fundação: monorepo, web, API, PostgreSQL e os checks do projeto.

Requisitos:

- Node.js 20 ou superior
- pnpm 10
- Docker, para o PostgreSQL

```bash
pnpm install
docker compose up -d
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3333/health

Os exemplos de ambiente estão em `apps/api/.env.example` e `apps/web/.env.example`.

---

# 🎯 Objetivo

O Nublar não deve ser apenas um registrador de despesas.

O objetivo é funcionar como um **dashboard completo da vida financeira**, reunindo:

**Fluxo financeiro**
- Receitas
- Despesas
- Transferências
- Categorias

**Compromissos**
- Cartões
- Faturas
- Parcelamentos
- Assinaturas
- Gastos recorrentes
- Contas futuras

**Patrimônio**
- Contas bancárias
- Dinheiro
- Renda fixa
- Ações
- FIIs
- ETFs
- Criptomoedas
- Outros investimentos
- Dívidas

**Planejamento**
- Metas financeiras
- Orçamentos
- Calendário financeiro
- Projeções mensais

**Análises**
- Evolução patrimonial
- Receitas × despesas
- Gastos por categoria
- Taxa de poupança
- Distribuição dos investimentos
- Comprometimento da renda
- Comparações mensais

---

# 🧠 Princípios do Produto

O Nublar deve priorizar:

1. **Simplicidade**
2. **Clareza**
3. **Boa visualização**
4. **Pouca fricção**
5. **Consistência financeira**
6. **Experiência premium e minimalista**

O usuário não deve precisar entender conceitos financeiros complexos para utilizar o sistema.

A interface deve apresentar primeiro as informações mais importantes e permitir aprofundamento quando necessário.

---

# 🏠 Dashboard

A Home deve responder rapidamente:

> **Como está minha vida financeira?**

Principais informações:

- Patrimônio total
- Saldo disponível
- Receitas do mês
- Despesas do mês
- Valor investido
- Saldo previsto
- Faturas abertas
- Próximos compromissos
- Evolução patrimonial
- Distribuição dos gastos
- Distribuição dos investimentos

O dashboard deve ser altamente visual e utilizar gráficos apenas quando eles facilitarem a compreensão.

---

# 🏦 Contas

O usuário pode possuir múltiplas contas.

Exemplos:

- Nubank
- Itaú
- Inter
- Mercado Pago
- Dinheiro
- Corretora
- Carteira de criptomoedas

Tipos inicialmente previstos:

```text
CHECKING
SAVINGS
CASH
BROKERAGE
CRYPTO
OTHER
```

Cada movimentação deve estar relacionada a uma conta quando aplicável.

---

# 💸 Transações

Transações são parte central do domínio do Nublar.

Tipos iniciais:

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

Possíveis origens:

```text
MANUAL
CSV_IMPORT
OFX_IMPORT
OPEN_FINANCE
```

Inicialmente será utilizado principalmente `MANUAL`.

A arquitetura deve permitir adicionar novas origens sem alterar significativamente o domínio.

---

# 🔄 Transferências

Transferências entre contas pertencentes ao mesmo usuário **não são receitas nem despesas**.

Exemplo:

```text
Itaú → Nubank
R$ 500
```

O patrimônio do usuário permanece o mesmo.

Esta regra deve ser respeitada em dashboards, relatórios e análises.

---

# 💳 Cartões

O sistema deverá permitir cadastrar múltiplos cartões.

Cada cartão pode possuir:

- Nome
- Instituição
- Limite
- Dia de fechamento
- Dia de vencimento
- Conta utilizada para pagamento
- Status

Compras realizadas no cartão devem impactar a fatura correspondente.

---

# 🧾 Parcelamentos

Compras parceladas devem gerar parcelas individuais associadas à compra original.

Exemplo:

```text
Compra: Notebook
Valor: R$ 6.000
Parcelamento: 12x R$ 500
```

O sistema deve conhecer os compromissos futuros:

```text
Outubro     1/12    R$ 500
Novembro    2/12    R$ 500
Dezembro    3/12    R$ 500
...
```

Isso será utilizado nas projeções financeiras.

---

# 🔁 Transações Recorrentes

O sistema deve permitir receitas e despesas recorrentes.

Exemplos:

```text
Salário
Aluguel
Netflix
Spotify
Academia
Internet
Seguro
```

Uma recorrência não deve exigir que o usuário cadastre manualmente o mesmo compromisso todos os meses.

---

# 📈 Investimentos

O Nublar deverá acompanhar diferentes classes de ativos.

Inicialmente:

```text
FIXED_INCOME
STOCK
FII
ETF
CRYPTO
OTHER
```

O usuário poderá registrar:

- instituição;
- ativo;
- quantidade;
- valor aplicado;
- valor atual;
- data da aplicação;
- vencimento, quando aplicável;
- classe do ativo.

Na primeira versão, valores poderão ser atualizados manualmente.

Integrações e cotações automáticas poderão ser implementadas posteriormente.

---

# 💎 Patrimônio

Uma das métricas principais do Nublar será o patrimônio.

Conceitualmente:

```text
Patrimônio Líquido =
Ativos
-
Passivos
```

O sistema deverá manter histórico suficiente para apresentar a evolução patrimonial.

Exemplo:

```text
Janeiro     R$ 32.000
Fevereiro   R$ 34.500
Março       R$ 37.200
Abril       R$ 40.100
```

---

# 🎯 Metas

O usuário poderá criar metas financeiras.

Exemplos:

```text
Reserva de emergência
R$ 12.000 / R$ 20.000

Viagem
R$ 3.500 / R$ 10.000

Entrada do carro
R$ 20.000 / R$ 50.000
```

Investimentos ou contas poderão futuramente ser associados a metas.

---

# 📅 Calendário Financeiro

O Nublar deverá permitir visualizar compromissos futuros.

Exemplo:

```text
01/10  Fatura Nubank       - R$ 1.820
05/10  Salário             + R$ 8.500
08/10  Netflix             - R$ 45
10/10  Aluguel             - R$ 1.500
15/10  Investimento        - R$ 1.000
```

O calendário será utilizado também para projeções.

---

# 🔮 Projeção Financeira

O sistema deverá utilizar:

- saldo atual;
- receitas recorrentes;
- despesas recorrentes;
- parcelas futuras;
- faturas;
- investimentos planejados;

para calcular uma previsão financeira.

Exemplo:

```text
Saldo atual                  R$ 3.200
Receitas previstas         + R$ 8.500
Despesas previstas         - R$ 4.100
Cartões                    - R$ 1.850
Investimentos planejados   - R$ 1.500

Saldo previsto               R$ 4.250
```

---

# 📊 Analytics

Algumas análises previstas:

- Receitas × despesas
- Gastos por categoria
- Evolução mensal
- Evolução patrimonial
- Distribuição dos investimentos
- Gastos fixos × renda
- Gastos variáveis
- Taxa de poupança
- Média mensal de gastos
- Comprometimento futuro
- Comparação entre meses

Analytics deve consumir regras e dados provenientes do backend.

Regras financeiras críticas **não devem existir somente no frontend**.

---

# 🏗️ Arquitetura

O projeto utilizará inicialmente um **Modular Monolith**.

Não utilizar microserviços prematuramente.

A arquitetura deve favorecer:

- modularidade;
- baixo acoplamento;
- testabilidade;
- manutenção;
- crescimento gradual;
- possibilidade futura de extração de serviços.

Fluxo principal:

```text
Web
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
PostgreSQL
```

Futuramente:

```text
Web ───────┐
           │
Mobile ────┼────► Nublar API ────► PostgreSQL
           │
Integrações┘
```

O backend é a **fonte da verdade das regras financeiras**.

---

# 🛠️ Stack

## Monorepo

```text
pnpm
Turborepo
```

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
React Hook Form
Zod
Recharts
```

## Backend

```text
Node.js
NestJS
TypeScript
Prisma
PostgreSQL
```

## Infraestrutura

```text
Docker
Docker Compose
GitHub Actions
```

## Testes

```text
Vitest
Testing Library
Jest
Playwright
```

Redis poderá ser introduzido futuramente caso exista uma necessidade real.

---

# 📁 Estrutura do Monorepo

```text
nublar/

apps/
├── web/
│   └── Next.js
│
├── api/
│   └── NestJS
│
└── mobile/
    └── React Native (futuro)

packages/
├── types/
├── validation/
├── eslint-config/
└── tsconfig/

docs/
├── architecture/
├── database/
├── product/
└── decisions/

infra/
├── docker/
└── scripts/

docker-compose.yml
package.json
pnpm-workspace.yaml
turbo.json
README.md
```

---

# 🧩 Organização do Backend

Exemplo:

```text
apps/api/src/modules/

auth/
users/
accounts/
transactions/
categories/
credit-cards/
installments/
recurring/
investments/
goals/
analytics/
net-worth/
```

Quando necessário, módulos podem possuir:

```text
module/
├── domain/
│   ├── entities/
│   └── repositories/
│
├── application/
│   ├── use-cases/
│   └── dto/
│
├── infrastructure/
│   └── repositories/
│
└── presentation/
    └── controllers/
```

Não aplicar abstrações sem necessidade.

A arquitetura deve permanecer simples enquanto preservar separação de responsabilidades.

---

# 🎨 Organização do Frontend

```text
apps/web/src/

app/
components/
features/
hooks/
lib/
services/
types/
```

Features principais:

```text
features/

dashboard/
transactions/
accounts/
cards/
investments/
goals/
analytics/
```

Componentes específicos de uma feature devem permanecer dentro dela.

Componentes realmente reutilizáveis podem existir em `components`.

---

# 💰 Valores Monetários

**Nunca utilizar floating point como representação persistente de dinheiro.**

Não utilizar:

```text
1234.56
```

como `float` para cálculos monetários críticos.

Preferencialmente armazenar valores na menor unidade da moeda.

Exemplo:

```text
R$ 1.234,56
↓
123456 centavos
```

Representação:

```text
amount: bigint
currency: BRL
```

Conversões para valores formatados devem acontecer somente nas bordas da aplicação.

---

# 🔐 Segurança

Como o sistema trabalha com informações financeiras, segurança deve ser considerada desde o início.

Princípios:

- Senhas nunca armazenadas em texto puro.
- Utilizar hashing seguro.
- Nunca registrar senhas ou tokens em logs.
- Secrets nunca devem ser commitados.
- Utilizar variáveis de ambiente.
- Validar inputs no backend.
- Autenticação e autorização devem existir no backend.
- Endpoints privados devem validar o usuário.
- Um usuário nunca pode acessar dados financeiros pertencentes a outro usuário.
- Não confiar em IDs enviados pelo frontend para autorização.
- Dados sensíveis não devem ser expostos desnecessariamente.

---

# 🔌 Open Finance

Open Finance **não faz parte do MVP**.

Entretanto, a arquitetura deve permitir sua implementação futura.

Por isso transações possuem uma origem:

```text
MANUAL
CSV_IMPORT
OFX_IMPORT
OPEN_FINANCE
```

Nunca implementar integrações bancárias utilizando credenciais bancárias fornecidas diretamente pelo usuário.

Integrações futuras deverão utilizar mecanismos oficiais e seguros.

---

# 📥 Importação

Antes de Open Finance, estão previstas:

```text
CSV Import
OFX Import
```

Fluxo desejado:

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

Regras poderão permitir categorização automática.

Exemplo:

```text
"UBER"       → Transporte
"SPOTIFY"    → Assinaturas
"NETFLIX"    → Assinaturas
```

---

# ⚠️ Regras Importantes para Agentes de IA

Cursor, Claude e demais agentes trabalhando neste projeto devem respeitar as seguintes regras:

### 1. Não alterar arquitetura sem justificativa

Mudanças arquiteturais relevantes devem ser documentadas.

### 2. Não adicionar dependências desnecessariamente

Antes de instalar uma biblioteca, verificar se a funcionalidade já pode ser realizada com as dependências existentes.

### 3. Não duplicar regras financeiras

Regras críticas pertencem ao backend.

### 4. Controllers devem permanecer simples

Controllers recebem requests, validam entrada básica, chamam application services/use cases e retornam responses.

Não colocar regras complexas de negócio em controllers.

### 5. Não utilizar float para dinheiro

Valores monetários devem utilizar representação segura.

### 6. Transferências próprias não são despesas

Transferências entre contas do mesmo usuário não alteram patrimônio e não entram como receita/despesa.

### 7. Investimentos não são gastos de consumo

Aporte financeiro representa movimentação patrimonial.

Analytics deve distinguir investimento de despesa.

### 8. Não confiar no frontend

Toda regra relevante deve ser validada no backend.

### 9. Código deve ser tipado

Evitar `any`.

Utilizar TypeScript corretamente.

### 10. Manter módulos independentes

Evitar dependências circulares e acoplamento desnecessário.

### 11. Implementar somente o necessário

Evitar overengineering.

Não adicionar:

```text
Microservices
Kafka
Kubernetes
Event Sourcing
CQRS complexo
```

sem necessidade real demonstrada.

### 12. Testar regras financeiras

Use cases envolvendo cálculos, parcelas, transferências, recorrências e projeções devem possuir testes automatizados.

---

# 🤖 Desenvolvimento com IA

O projeto será desenvolvido principalmente utilizando:

- Cursor
- Orca IDE
- Claude
- Agentes de IA

Antes de implementar uma tarefa, o agente deve:

1. Ler este README.
2. Identificar os módulos afetados.
3. Entender as regras de negócio relacionadas.
4. Verificar implementações existentes.
5. Evitar duplicação.
6. Planejar a mudança.
7. Implementar.
8. Executar lint/typecheck.
9. Executar testes relevantes.
10. Informar claramente o que foi alterado.

Não assumir regras financeiras não documentadas.

Caso exista ambiguidade que possa alterar comportamento financeiro relevante, perguntar antes de implementar.

---

# 🗺️ Roadmap Inicial

## Fase 0 — Fundação

- Monorepo
- Next.js
- NestJS
- PostgreSQL
- Prisma
- Docker
- Configuração de ambiente
- Lint
- Typecheck
- Testes
- CI

## Fase 1 — Core Financeiro

- Usuário
- Autenticação
- Contas
- Categorias
- Receitas
- Despesas
- Transferências
- Histórico de transações

## Fase 2 — Compromissos

- Cartões
- Faturas
- Compras
- Parcelamentos
- Despesas recorrentes
- Receitas recorrentes

## Fase 3 — Dashboard

- Patrimônio
- Saldo disponível
- Receitas
- Despesas
- Investimentos
- Faturas
- Próximos compromissos
- Gráficos
- Comparações mensais

## Fase 4 — Investimentos

- Renda fixa
- Ações
- FIIs
- ETFs
- Criptomoedas
- Outros ativos
- Distribuição patrimonial
- Rentabilidade

## Fase 5 — Planejamento

- Metas
- Orçamentos
- Calendário financeiro
- Projeções

## Fase 6 — Automação

- CSV
- OFX
- Detecção de duplicados
- Regras de categorização
- Categorização automática

## Futuro

- Open Finance
- React Native
- Sincronização bancária
- Cotações automáticas
- Notificações
- Insights inteligentes

---

# 🦖 Identidade

**Nome:** Nublar

A identidade do projeto combina:

- natureza;
- evolução;
- crescimento;
- patrimônio;
- tecnologia;
- referência sutil ao universo dos dinossauros.

O design deve ser:

- moderno;
- minimalista;
- premium;
- escuro;
- elegante;
- altamente visual.

A referência a dinossauros deve permanecer sutil e não transformar o sistema em uma interface temática ou infantil.

---

# 📌 Filosofia

> **Nublar transforma informações financeiras complexas em uma visão simples da evolução do seu patrimônio.**

O sistema deve ajudar o usuário a responder três perguntas:

**Onde estou?**

**Para onde meu dinheiro está indo?**

**Para onde minhas finanças estão caminhando?**

---

**Status:** Em desenvolvimento  
**Plataforma inicial:** Web/Desktop  
**Mobile:** Planejado  
**Uso inicial:** Pessoal