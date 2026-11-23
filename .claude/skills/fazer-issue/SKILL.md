---
name: fazer-issue
description: Realiza uma issue do GitHub do Nublar de ponta a ponta — lê a issue, prepara a branch/worktree, implementa, roda os checks, gera evidências (testes, capturas main × branch, diff de pixels), faz commit, abre o PR com as evidências e explica como testar. Use quando pedirem "faça a issue #N", "realize a issue", "/fazer-issue N", ou quando uma tarefa do Orca vier de uma issue.
argument-hint: <número da issue>
---

# Fazer issue

Fluxo padrão do Nublar para transformar uma issue em PR pronto para revisão.
Argumento: `$ARGUMENTS` (número da issue, com ou sem `#`, ou a URL dela).
Se não houver número, pergunte qual issue fazer e pare.

Fale com o usuário em **português**. Commits e PR em português, no formato abaixo.

**Nunca** faça merge, `push --force` na `main`, nem feche issues manualmente. O PR fecha a issue com `Closes #N` quando o humano fizer o merge.

---

## 1. Entender a issue

```bash
gh issue view <N> --json number,title,body,labels,milestone,state
```

- Se estiver fechada, avise e pare.
- Leia a seção **Depende de**. Para cada dependência, rode `gh issue view <dep> --json state,title`. Se alguma estiver aberta, avise quais faltam e pergunte se deve seguir mesmo assim.
- Os **critérios de aceite** (checklist) são o contrato do trabalho. Cada um precisa estar feito ou explicitamente justificado no PR.

## 2. Preparar o ambiente

**Branch.** Rode `git branch --show-current`.
- Se for `main`: `git switch main && git pull --ff-only`, depois `git switch -c <tipo>/<N>-<slug-curto>`.
  - `tipo`: `feat` (enhancement), `fix` (bug), `refactor`, `chore` ou `docs`.
  - Exemplo: `feat/3-preferencias-usuario`.
- Se já estiver numa branch que não é a `main` (workspace criado pelo Orca), use essa branch.
  - Confirme que ela parte da `main` atual: `git merge-base --is-ancestor origin/main HEAD`. Se não partir, rode `git rebase origin/main` (a branch é nova, sem trabalho de outros).

**Worktree novo do Orca.** O workspace não traz `.env` nem dependências instaladas.
- O checkout principal é a primeira linha de `git worktree list`.
- Para cada `apps/*/.env` que existir lá e faltar aqui, copie o arquivo. **Nunca** imprima o conteúdo de `.env`.
- Se não existir `node_modules`, rode `pnpm install --frozen-lockfile`.
- Rode `pnpm --filter @nublar/api db:generate`, que gera o client do Prisma usado pelo typecheck.

Ao terminar a preparação, informe ao usuário em uma linha: a issue, a branch e os critérios de aceite que você vai cumprir.

## 3. Implementar

- **Siga o código existente.** Leia `docs/tecnico.md` e as decisões em `docs/decisions/` relevantes antes de mudar a arquitetura.
- **Desktop** (`apps/desktop`):
  - cores só via tokens de `src/styles/tokens.css` (o teste `tokens.test.ts` bloqueia cor fixa);
  - textos em pt-BR (até a issue de i18n existir);
  - componentes de `src/components`.
- **API** (`apps/api`):
  - NestJS + Prisma;
  - migration nova em `apps/api/prisma/migrations` quando o schema mudar;
  - validação compartilhada em `packages/validation` (zod).
- **Testes:** escreva testes para a lógica nova (vitest no desktop, jest/spec na API).
- **Princípios do produto:** simples, claro, pouca fricção. Na dúvida entre duas soluções, escolha a mais simples.
- **Escopo:** não faça mudanças fora da issue. Se achar algo relevante fora do escopo, anote para o resumo final como sugestão de issue nova.

## 4. Checks (iguais ao CI)

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

- Todos precisam passar. Se falhar, corrija e rode de novo.
- Se a falha já existia na `main`, não esconda: confirme rodando na `main` e registre no PR.
- Guarde a saída resumida (linhas de resultado) para as evidências, sem códigos de cor: `NO_COLOR=1 FORCE_COLOR=0`.

## 5. Evidências

Salve tudo em uma pasta temporária `EVID` (o scratchpad da sessão, **nunca** dentro do repo).

**a) Checks:** use as linhas de resultado da etapa 4.

**b) Prova dos testes novos:** quando fizer sentido, mostre que o teste pega o erro.
- Quebre de propósito a regra testada e rode só aquele teste.
- Guarde a saída de falha e **reverta** com `git checkout -- <arquivo>`.
- Confira com `git status` que nada ficou alterado.

**c) Capturas, só se a issue mexe na interface:**
1. Monte a pasta de ferramentas, fora do repo:
   ```bash
   mkdir -p "$EVID/tools" && cd "$EVID/tools" && npm init -y >/dev/null && npm i playwright-core@1.48.2 --silent
   ```
2. Compile as duas versões.
   - **main:** `git worktree add "$EVID/main-wt" origin/main`, copie `apps/desktop/.env`, rode `pnpm install --frozen-lockfile --filter "@nublar/desktop..."` e depois, em `apps/desktop`, `pnpm exec vite build --outDir "$EVID/dist-main"`.
   - **branch:** em `apps/desktop`, `pnpm exec vite build --outDir "$EVID/dist-branch"`.
3. Sirva as duas em segundo plano, a partir de `apps/desktop`:
   - `pnpm exec vite preview --outDir "$EVID/dist-main" --port 4174 --strictPort`
   - `pnpm exec vite preview --outDir "$EVID/dist-branch" --port 4173 --strictPort`
4. Capture e compare:
   ```bash
   node .claude/skills/fazer-issue/scripts/capture.mjs "$EVID/shots" .claude/skills/fazer-issue/scripts/shots.example.json
   python -I .claude/skills/fazer-issue/scripts/pixel-diff.py "$EVID/shots/<x>-main.png" "$EVID/shots/<x>-branch.png"
   ```
   - Rode o `capture.mjs` com `TOOLS_DIR="$EVID/tools"` (pasta onde o playwright-core foi instalado).
   - Copie `shots.example.json` para `$EVID` e ajuste as capturas da issue. Cada captura pode injetar CSS ou rodar JS antes, por exemplo para abrir um modal ou aplicar um tema.
5. Interprete o resultado:
   - **Mudança só interna** (refactor): espere **0 pixels diferentes** e mostre isso.
   - **Mudança visual:** mostre antes e depois lado a lado e descreva a diferença.
6. Limpe: pare os servidores e rode `git worktree remove --force "$EVID/main-wt"` e depois `git worktree prune`.

Limitação: o app logado exige uma conta real. As capturas automáticas cobrem o que aparece sem login. Telas logadas entram no PR como **teste manual pendente** (checkbox desmarcado) para o humano validar.

**d) Publicar as imagens** na branch órfã `pr-evidence`, que nunca vai para a `main`:
```bash
git fetch origin pr-evidence
git worktree add "$EVID/ev-wt" origin/pr-evidence
cd "$EVID/ev-wt" && git switch -c pr-evidence-tmp
mkdir -p issue-<N> && cp "$EVID"/shots/*.png issue-<N>/
git add issue-<N> && git commit -m "docs: evidências da issue #<N>"
git push origin HEAD:pr-evidence
```
- Se `pr-evidence` não existir: crie com `git switch --orphan pr-evidence`, rode `git rm -rf --cached .` e `git clean -fdx` **dentro do worktree temporário**, e só então adicione os arquivos.
- URL das imagens: `https://raw.githubusercontent.com/<owner>/<repo>/pr-evidence/issue-<N>/<arquivo>.png`
- No fim, remova o worktree temporário.

## 6. Commit e PR

**Commit:** Conventional Commits, assunto em inglês com até 72 caracteres e corpo explicando o porquê, terminando com:
```
Closes #<N>

Co-Authored-By: Claude <noreply@anthropic.com>
```
- Não comite `.env`, imagens de evidência, `dist/` nem arquivos temporários.
- Confira `git status` antes do commit.

**PR:**
```bash
git push -u origin <branch>
gh pr create --base main --title "<tipo>(<escopo>): <resumo em pt-BR>" --body-file <arquivo> \
  --label <labels da issue> --milestone "<milestone da issue>"
```

Corpo do PR, nesta ordem:
1. **Resumo:** 2 ou 3 frases sobre o que mudou e por quê, e `Closes #<N>`.
2. **O que mudou:** bullets por arquivo ou área.
3. **Critérios de aceite:** o checklist da issue, marcado com `[x]`. Itens não feitos ficam com `[ ]` e uma justificativa.
4. **Evidências:**
   - capturas (tabela antes × depois e número de pixels diferentes);
   - saída dos checks em bloco de código;
   - prova do teste de proteção, se houver.
5. **Teste manual:** checklist do que o humano deve conferir no app logado.
6. **Como testar:** comandos para rodar.
7. Rodapé: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

Depois de criar o PR, rode `gh pr checks <PR>` uma vez para informar o estado do CI. Não fique esperando o CI terminar.

## 7. Resposta final ao usuário

Curta, em português:
- link do PR;
- **o que foi feito**, em 3 a 6 bullets;
- **evidências**, em 1 a 3 bullets com os números (testes, pixels);
- **como testar**: comandos e o roteiro manual curto;
- pendências ou riscos, e sugestões de issues novas (sem criar);
- próxima issue sugerida: a próxima aberta da mesma milestone, por prioridade (`P1` antes de `P2`), cujas dependências estejam fechadas.
