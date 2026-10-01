# 0002 — Investimentos e análises

Data: 2026-10-01 · Status: aceita (proposta pelo agente; revisar se algum número não bater com a intuição)

## Investimento é posição, não conta

Um investimento (CDB, ação, FII, ETF, cripto…) é uma **posição** dentro de uma instituição, com classe de ativo, nome e, opcionalmente, código e quantidade (só informativos: não há cotação automática).

## Valor da posição

O valor vem de **avaliações manuais** ("em tal data valia tanto"):

- Valor numa data = última avaliação até ela + aportes − resgates que ela ainda não reflete.
- Uma avaliação reflete tudo de dias anteriores e, no próprio dia, o que foi registrado antes dela.
- Antes da primeira avaliação o valor é zero.
- Ao cadastrar uma posição antiga, o valor aplicado vira uma avaliação na data de início e o valor atual vira uma avaliação hoje. O histórico entre as duas é um degrau: o Nublar não inventa rendimento.
- **Modo simples** (só "quanto tenho hoje"): aplicado = valor atual, então não aparece ganho falso. O valor vale desde o início do acompanhamento (primeiro lançamento), como o saldo inicial das contas, para não criar um salto no gráfico de patrimônio. O rendimento conta a partir das próximas atualizações.
- "Atualizado em" mostra quando o usuário informou o valor, não a data da avaliação.

## Renda fixa

Produto (CDB, LCI, LCA, Tesouro…), indexador e taxa (110% do CDI, IPCA + 6,5%, 12% a.a., Selic) e liquidez (diária ou no vencimento) são **informativos**: o Nublar não calcula rendimento sozinho. Servem para separar o que dá para sacar a qualquer momento do que fica preso até o vencimento, e para listar os vencimentos dos próximos 12 meses.

## Aporte e resgate

- **Aporte** (`INVESTMENT`): sai da conta, entra na posição. **Não é despesa.**
- **Resgate** (`REDEMPTION`): sai da posição, volta para a conta. **Não é receita.**
- Os dois não mudam o patrimônio; só trocam o dinheiro de lugar.
- Um resgate não pode passar do valor da posição na data.

## Rentabilidade

- Aplicado = valor inicial aplicado + aportes.
- Ganho = valor atual + resgatado − aplicado (realizado ou não).
- Rentabilidade = ganho ÷ aplicado. Não há custo médio por cota.
- Rendimento só vira receita se o usuário lançar como receita (ex.: dividendos caindo na conta).

## Patrimônio

Patrimônio = contas (com saldo inicial) + investimentos − dívida dos cartões.

O histórico mensal é recalculado a partir dos lançamentos e das avaliações. O saldo inicial das contas vale para todos os meses, já que representa o dinheiro de antes do acompanhamento.

## Análises

- **Médias** usam só os meses desde o primeiro lançamento, para os meses vazios não puxarem a média para baixo.
- **Taxa de poupança** = (receitas − despesas) ÷ receitas, por competência.
- **Composição de gastos**: fixos (vindos de recorrência), parcelados (compra no cartão em mais de uma parcela) e variáveis (o resto).
- **Compromissos futuros** (6 meses): parcelas já lançadas em cada fatura + recorrências ativas (as puladas não contam; as já confirmadas usam o valor confirmado).
- **Percentuais** são calculados em pontos-base inteiros. Dinheiro nunca passa por float.
