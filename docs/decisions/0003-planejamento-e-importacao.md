# 0003 — Repetição, planejamento e importação

Data: 2026-10-02 · Status: aceita (proposta pelo agente; revisar se algum número não bater)

## Repetição no lançamento

Ao lançar, o usuário escolhe **Não repete**, **Fixo todo mês** ou **Parcelado em N vezes**.

| Pago com | Não repete | Fixo todo mês | Parcelado |
|---|---|---|---|
| Conta | lançamento normal | recorrência no dia escolhido | recorrência com N parcelas |
| Cartão | compra à vista | recorrência em **toda fatura** | compra parcelada no cartão |

- **No cartão, o fixo** (Netflix, Spotify) entra em cada fatura, datado no **vencimento** dela; não há dia a escolher. Conta como despesa no mês da fatura (decisão 0001).
- **Parcelado na conta** (carnê, boleto parcelado): o total é dividido como no cartão, com o centavo que sobra na primeira parcela. Gera exatamente N ocorrências.
- **Primeira ocorrência**: quem lança no dia (data até hoje) já fez o pagamento, então a primeira entra **confirmada**. As seguintes ficam pendentes (decisão 0001).
- **Natureza dos gastos**: parcelas sempre contam como "parcelados", mesmo vindas de recorrência; o resto das recorrências conta como "fixos".

## Orçamentos

- Um limite mensal por categoria de despesa, igual todo mês.
- O gasto é por **competência**: compras no cartão contam no mês da fatura.
- Pendentes não contam como gasto; aparecem à parte, como "previsto".
- O orçamento vira **alerta aos 80%** e **estourado acima de 100%**.

## Metas

- Guardado = valor manual + saldo das contas ligadas + valor de hoje dos investimentos ligados.
- **Por mês** = falta ÷ meses restantes (contando o mês atual), **arredondado para cima** para que seguir o plano chegue à meta.
- O prazo vence no último dia do mês escolhido.

## Calendário e projeção

- O calendário mostra o que mexe no dinheiro das contas: lançamentos (inclusive pendentes), vencimento de faturas e de investimentos. Compras no cartão aparecem via fatura, não no dia da compra.
- **Saldo dia a dia**: real até hoje; depois, saldo de hoje + pendentes − faturas que ainda vencem.
- **Projeção mensal**: saldo de hoje + receitas recorrentes − fixos − parcelas − **média do gasto variável dos 3 meses anteriores** (a parte que ninguém agenda).
- No mês atual, a projeção desconta o que ainda falta: pendentes, faturas que vencem depois de hoje e o gasto variável médio que ainda não aconteceu.

## Importação (OFX/CSV)

- Nada é gravado antes da revisão.
- **Duplicado**: mesmo identificador do banco (FITID) **ou** mesma conta + data + valor de algo já lançado (cada lançamento existente explica só uma linha). Duplicados vêm desmarcados.
- **Categorização**: primeiro as regras do usuário (palavra-chave mais longa vence), depois um dicionário inicial (UBER → Transporte etc.). As palavras só casam no começo de uma palavra.
- **Aprendizado**: ao importar, o "comerciante" de cada linha (ex.: "padaria sao joao") vira regra para a categoria escolhida; a última escolha vale.
- Transferências entre contas próprias devem ser desmarcadas e lançadas como transferência: o arquivo do banco não sabe que a outra conta é sua.
