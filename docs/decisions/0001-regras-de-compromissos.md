# 0001 — Regras financeiras de cartões, parcelas e recorrências

Data: 2026-10-01 · Status: aceita

Decisões tomadas pelo dono do produto antes da Fase 2. Qualquer mudança aqui altera números de relatórios e precisa de nova decisão.

## Saldo inicial de conta

Cada conta tem `openingBalance`: o que ela já tinha quando o usuário começou a usar o Nublar.

- Entra no saldo da conta e no patrimônio.
- **Não** é receita e não aparece em nenhum relatório mensal.

## Cartão de crédito: competência no mês da fatura

Uma compra no cartão conta como **despesa no mês da fatura** em que ela cai, não no mês da compra.

- O mês da fatura é o mês do **vencimento**.
- Compras feitas **no dia do fechamento ou depois** vão para a fatura seguinte.
- Se o vencimento é antes ou no mesmo dia do fechamento (ex.: fecha 28, vence 5), a fatura vence no mês seguinte ao fechamento.
- Dias que o mês não tem (ex.: 31 em fevereiro) usam o último dia do mês.

A compra reduz o patrimônio **no momento da compra**: a dívida do cartão é passivo. O valor total ainda não pago (incluindo parcelas futuras) é a dívida do cartão.

## Pagamento de fatura

Pagar a fatura move dinheiro de uma conta para o cartão (`CARD_PAYMENT`).

- Reduz o saldo da conta e a dívida do cartão.
- **Não** é despesa: a despesa já foi contada pelas parcelas no mês da fatura.

## Parcelamento

Uma compra parcelada em N vezes gera N parcelas, uma por fatura consecutiva.

- Divisão em centavos inteiros. O resto vai para a **primeira parcela**.
- Ex.: R$ 100,00 em 3x → 33,34 + 33,33 + 33,33.

## Recorrências

Receitas e despesas recorrentes geram lançamentos **pendentes** (`PENDING`) em cada mês.

- Pendentes **não** afetam saldo, patrimônio, receitas nem despesas.
- O usuário confirma (pode ajustar valor e data) e o lançamento vira `POSTED`.
- Pular um mês marca a ocorrência como `CANCELED`; ela não é gerada de novo.
- Ocorrências são geradas no máximo até 12 meses à frente do mês atual.

## Instituições, contas e cartões

Bancos, corretoras e carteiras digitais são **instituições**. Elas agrupam:

- **Contas**: conta corrente, poupança/caixinha, saldo na corretora, carteira cripto. O apelido é opcional; sem ele a conta aparece como "Instituição · Tipo".
- **Cartões de crédito**, que continuam também na tela Cartões.

Dinheiro em espécie é uma conta fora de qualquer instituição.

Investimentos (CDB, ações, FIIs…) **não** são contas: serão posições dentro da instituição (Fase 4). Mover dinheiro para um investimento é aporte, não despesa.

Uma instituição só pode ser excluída quando não tem contas nem cartões.
