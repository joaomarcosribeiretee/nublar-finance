# 0006 — Preço médio e lucro/prejuízo em cripto

Data: 2026-11-30 · Status: aceita (proposta pelo agente na issue #13)

## Quantidade nos aportes e resgates

- Em posições de **cripto**, aporte e resgate registram também **quantas moedas** entraram ou saíram (`Transaction.quantity`, texto decimal com ".", nunca float).
- A quantidade da posição é **atualizada junto**: aporte soma, resgate subtrai. Excluir o lançamento desfaz. O usuário não precisa mais editar a quantidade depois de cada movimento (antes, `0005` pedia isso).
- Se a posição já tem quantidade, a quantidade do movimento é obrigatória. Bitcoin segue em sats inteiros (no máximo 8 casas em BTC).
- Nenhuma operação pode deixar a posição com quantidade negativa (resgate maior do que se tem, ou excluir uma compra que já foi vendida).

## Preço médio ponderado

O método é o **custo médio ponderado** (o que a Receita Federal pede para cripto):

- **Compra** muda o preço médio: custo += valor pago; quantidade += moedas.
- **Venda** não muda o preço médio: as moedas saem pelo custo médio. Vender tudo zera o custo.
- Os movimentos são processados por data (empate: ordem de registro). Movimentos com data futura ficam de fora do resultado de hoje.
- **Lote inicial**: o que foi aplicado antes do acompanhamento (`openingApplied`) corresponde à quantidade que os movimentos não explicam: quantidade atual − compradas + vendidas.
- Preço médio = custo das moedas que restam ÷ quantidade, em centavos por moeda inteira, arredondado para cima a partir de meio centavo.

## Resultado

- **Não realizado** = valor atual − custo das moedas que restam. Percentual sobre esse custo.
- **Realizado** = Σ (valor da venda − custo médio das moedas vendidas). Percentual sobre o custo do que foi vendido.
- Os dois aparecem com `GainText` (verde ganhou, vermelho perdeu), como a rentabilidade do resto dos investimentos. A rentabilidade geral da posição (`0002`) continua igual.
- Frase de uma linha: "Você pagou em média R$ X por BTC".

## Quando não dá para calcular

O preço médio não aparece (e a tela pede a quantidade nos aportes e resgates) quando:

- a posição não tem quantidade;
- algum aporte ou resgate foi lançado sem quantidade (lançamentos de antes desta regra);
- o lote inicial teria dinheiro aplicado mas nenhuma moeda;
- uma venda é maior do que se tinha naquela data.
