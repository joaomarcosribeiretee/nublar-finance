# 0004 — Faturas completas e confirmação automática

Data: 2026-10-13 · Status: aceita (pedido do dono do produto) · Altera partes da 0001 e da 0003

## Problema

Recorrências no cartão (assinaturas, parcelados lançados como recorrência) nasciam **pendentes** e a fatura só somava o que estava confirmado. Resultado: a fatura de outubro do Banco do Brasil mostrava R$ 38,90 (só a compra avulsa) quando o real passava de R$ 1.100, e pagar os R$ 38,90 marcava a fatura como paga.

## Tudo que é do cartão está na fatura

- O total da fatura soma **todas** as cobranças daquele mês da fatura, confirmadas ou previstas. Só as puladas (`CANCELED`) ficam fora.
- **Previsto** = parte do total que ainda não foi confirmada. Aparece separado na aba Faturas.
- A dívida do cartão (limite usado, patrimônio) continua contando só o confirmado: assinatura do mês que vem ainda não aconteceu.
- Na lista de lançamentos do mês, qualquer despesa no cartão aparece no **mês da fatura** (antes só as compras faziam isso; recorrências apareciam pela data).

## Confirmação automática

Ocorrências de recorrências viram `POSTED` sozinhas:

- **Na conta**: na data da ocorrência.
- **No cartão**: quando a fatura **fecha** — a partir daí a cobrança está na fatura.
- Ocorrências **datadas antes de a recorrência ser cadastrada** não são confirmadas sozinhas: são meses que o usuário pode ter resolvido fora do app. Ficam pendentes para confirmar ou pular.
- Até a data, o usuário ainda pode ajustar ou pular a ocorrência.

Isso substitui o "o usuário confirma cada mês" da 0001: confirmar manualmente continua possível, mas não é mais necessário.

## Pagar a fatura confirma o que está nela

Registrar um pagamento de fatura confirma junto todas as cobranças previstas daquela fatura.

## Editar uma ocorrência não a tira da recorrência

- Editar um lançamento de recorrência muda **só aquele mês** e ele continua recorrente (antes, trocar o "pagar com" no formulário criava uma compra avulsa e apagava a ocorrência).
- Opção **"Este e os próximos"**: muda também a recorrência (valor, descrição, categoria, conta e dia) e regenera os pendentes seguintes. Em parcelados, o valor das outras parcelas continua vindo do total.
- Ocorrências no cartão ficam no cartão: o formulário não oferece trocar para conta.
- Excluir uma ocorrência (pendente ou confirmada) marca o mês como **pulado**; apagar de verdade só faria ela voltar.

## Prévia de rendimento (% do CDI)

- Renda fixa indexada ao CDI mostra quanto o **valor atual** renderia em 1 mês, 6 meses, 1 ano e até o vencimento.
- Juros compostos diários em 252 dias úteis; CDI constante, informado pelo usuário (padrão 14,90% a.a., guardado só neste computador).
- Líquido de IR pela tabela regressiva (22,5% → 15%) contando o tempo desde o início da aplicação. LCI, LCA e CRI/CRA são isentos.
- É **só prévia**: usa ponto flutuante e arredonda para centavos, nunca é gravada e não muda o valor da posição (que segue as avaliações da 0002).

## Mês da fatura reconfirmado (2026-10-13)

Perguntado de novo, o dono do produto manteve: gasto no cartão conta no **mês da fatura** (não no da compra, nem quando é pago). Na lista de lançamentos, as despesas no cartão ficam num bloco "Fatura <cartão> · vence <dia>", posicionado no vencimento, com a data da compra em cada linha.

- Pagamento de fatura é recusado quando a fatura já está paga ou quando o valor passa do que falta.
- Fatura com total zero e algum pagamento conta como paga.
