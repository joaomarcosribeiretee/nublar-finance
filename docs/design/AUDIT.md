# Repaginação visual: auditoria

Branch `repaginacao-visual`. Escopo: `apps/desktop/src` (o mesmo código roda no
Electron e no site). Método: skills `visant-killer`, `visant-frontend`,
`visant-motion` e `visant-refine`.

## Superfícies

| Rota | Classe | Variável que move | Persuasão |
|---|---|---|---|
| Entrar / criar conta | A aquisição | conversão de cadastro | nome, frase e um formulário; nada além |
| Início | B trabalho | qualidade da decisão do mês (sobrou ou faltou) | nenhuma |
| Lançamentos | B trabalho | lançamentos registrados por minuto | nenhuma |
| Análises | B trabalho | qualidade da decisão (tendência, para onde foi) | nenhuma |
| Instituições | C confiança | saldo correto por conta | nenhuma |
| Investimentos | C confiança | valor de posição correto | nenhuma |
| Cartões | C confiança | limite e fatura corretos | nenhuma |
| Faturas | C confiança | fatura paga no valor e no mês certos | nenhuma |
| Orçamentos | B trabalho | gasto dentro do limite | nenhuma |
| Metas | B trabalho | retenção (progresso visível) | nenhuma |
| Calendário | B trabalho | saldo futuro sem surpresa | nenhuma |
| Recorrentes | C confiança | lançamento automático correto | nenhuma |
| Categorias | B trabalho | lançamentos classificados | nenhuma |

## Tela vista

Aberta em Chrome com a API simulada (dados de pior caso: nomes longos, valores
de nove dígitos, todos os estados). Não foi aberta contra a API real nem dentro
do Electron.

| Rota | Largura | Dados | Resultado |
|---|---|---|---|
| 12 telas, topo e fim da rolagem | 390 | pior caso | estouro horizontal 0 em todas |
| 12 telas, topo e fim da rolagem | 1240 | pior caso | estouro horizontal 0 em todas |
| 13 modais, topo e fim | 390 e 1240 | pior caso | estouro 0; rodapé visível; console sem erro |

## Portões

| Detector | Antes | Depois |
|---|---|---|
| `motion-lint` | 29 (15 altos) | 0 |
| `killer-scan` token | 6 | 0 |
| `killer-scan` ruído | 17 | 0 |
| `refine-scan` | 49 | 27, todos exceção escrita abaixo |
| `copy-lint` | não rodado antes | 18, não aplicados (abaixo) |

EXCEÇÃO ao refine-scan/CHART_RAW_COLOR: os tokens deste app guardam a cor
inteira (`--gold: #c9a45c`), não canais HSL soltos, então `var(--gold)` é uma
cor válida numa prop do recharts.

EXCEÇÃO ao refine-scan/CHART_WITHOUT_STATE: todo gráfico troca por skeleton
enquanto carrega e a tela inteira troca por erro ou estado vazio; o detector
procura um componente `ChartState` que este app não tem.

`copy-lint` não aplicado: aponta o separador `·` em metadados e frases como
"não é despesa nem receita". O separador é o padrão do app e a frase explica
uma regra contábil; trocar é decisão de voz do produto.

## O que não foi verificado

- API real, banco real e login real.
- Janela do Electron (arrasto da barra de título, controles da janela).
- Leitor de tela e navegação só por teclado, além do que o código garante.
- Safari no iPhone (zoom em campo, área segura) foi tratado no código e não medido.

## Segunda passagem: mudança de composição

A primeira passagem acima priorizou responsividade e correções. Nesta passagem,
a composição visual mudou: login em duas colunas no desktop, apresentação compacta
no celular, navegação com ação principal permanente, barra de contexto, cabeçalhos
maiores e painel de patrimônio com destaque dourado. O primeiro acesso ganhou
uma apresentação própria com o botão de adicionar instituição antes das etapas.
Os componentes PageHeader e Panel levam a hierarquia às demais telas.

Validação desta passagem: typecheck, lint, build e 38 testes do desktop passaram.
Login inspecionado em 1440px e 390px; painel inspecionado nessas larguras com
fixtures no cache de um QueryClient isolado, sem chamadas à API ou gravações.
No painel mobile não houve elementos ultrapassando a largura da viewport.
Essa inspeção não valida autenticação, persistência nem a janela Electron.
As fixtures foram removidas ao recarregar a página; não há modo demo no app.

## Plano da revisão integral

Escopo: todas as 13 telas, navegação, formulários e estados de dados. A tabela de
superfícies acima continua sendo o contrato: trabalho e confiança, sem persuasão
no dashboard. Preservar paleta, cálculos em centavos e os fluxos de gravação.

| Necessidade | Já existe em | Aplicação |
|---|---|---|
| Cabeçalhos e blocos | components/Page.tsx | Hierarquia e espaçamento compartilhados |
| Gráficos e métricas | components/charts.tsx, Recharts | Painéis por assunto, valores acessíveis sem hover |
| Seletores | components/Segmented.tsx | Filtros de metas, carteira e análises |
| Formulários | Field.tsx, Modal.tsx, FormFooter | Foco, rolagem, ações e mensagens consistentes |
| Movimento e cores | index.css | Reusar tokens e respeitar movimento reduzido |
| Feedback | Toast.tsx, ErrorNote, EmptyState | Distinguir falha, ausência e carregamento |

Decisões antes das alterações: resumos do início abrem lançamentos filtrados;
análises se dividem em patrimônio, fluxo e compromissos; carteira filtra por classe;
metas separam em andamento e concluídas; orçamentos destacam o que exige atenção;
calendário prioriza seleção do dia; instituições mostram identidade antes dos valores.
Sem dependências novas nem cópia da pasta de skills para o repositório.

Gate inicial: killer encontrou duas sombras fora dos tokens e três números
ornamentais no primeiro acesso. Refine apontou 27 ocorrências: cores em var()
são válidas porque os tokens contêm cores completas; os estados precisam de
inspeção manual (o detector procura nomes específicos de wrappers).

## Terceira passagem: dashboards mais simples

Corte pelo teste das skills (cada bloco nomeia a variável que move):

- Início: de 6 blocos para 4. O resultado do mês é o herói (decisão: sobrou ou
  faltou), com "entrou" e "saiu" na mesma escala. Patrimônio vira contexto ao lado.
  Os cartões de receita/despesa/resultado, que repetiam o herói, saíram. Fatura,
  pendência e orçamento estourado viram uma lista única "Precisa de atenção", que
  só aparece quando há algo. Metas e orçamentos em dia saíram do Início
  (continuam nas suas telas). `PlanningGlance` removido.
- Análises: de 5 indicadores para 2 e de 7 gráficos para 5. Saíram taxa de poupança
  e composição do gasto (a taxa continua no indicador "Sobrou no mês").

Vista: Chrome com API simulada por interceptação de rede (dados de caso normal,
não de pior caso), 1440 e 390. Estouro horizontal não foi remedido nesta passagem.
Typecheck, lint e 38 testes passaram; refine-scan 23 (exceções acima).
