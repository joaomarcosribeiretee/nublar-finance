# 0005 — Cotação automática de cripto

Data: 2026-11-27 · Status: aceita (proposta pelo agente na issue #11)

## O que é

Investimentos de cripto em moedas suportadas valem **quantidade × cotação em BRL**, sem o usuário digitar o valor.

- Moedas: BTC, ETH, SOL, USDT, USDC. A lista fica em `cryptoCoins` (`@nublar/validation`); para incluir uma moeda, basta somar o id da CoinGecko ali.
- O código digitado (ex.: "BTC") escolhe a moeda. Com moeda suportada, o switch **"Atualizar cotação automaticamente"** vem ligado em posições novas.
- Desligado, tudo funciona como antes: o valor é informado à mão.

## Fonte e cache

- CoinGecko `simple/price` (pública, sem chave), consultada **só pela API**; o desktop nunca chama a fonte.
- Uma consulta traz todas as moedas. Cache de **5 minutos** em memória, compartilhado entre usuários.
- O botão de atualizar pula o cache, mas no máximo uma vez por minuto.
- Dinheiro nunca passa por float: o preço é guardado como texto decimal e a multiplicação usa inteiros.

## Valor e histórico

- Ao abrir a tela de investimentos (lista ou detalhe), a API grava uma **avaliação automática do dia** para cada posição com cotação: quantidade × cotação.
- É **uma avaliação por dia**, atualizada no lugar. Os dias anteriores ficam com a cotação deles, e o histórico do patrimônio continua certo.
- Cada sucesso também grava a cotação do dia em `CryptoQuote` (o snapshot diário, de onde vem o último preço depois de reiniciar a API).
- Dias em que ninguém abriu a tela não têm avaliação automática: o valor fica no do último dia registrado (degrau), como acontece com as avaliações manuais.
- Com a cotação ligada, a quantidade é o que manda. Depois de um aporte ou resgate, atualize a quantidade.

## Quando a fonte falha

- Nada é gravado e o **último valor fica**, nunca zero.
- A tela mostra um aviso discreto ("Não deu para atualizar a cotação. Mantendo o último valor.").
- Uma posição nova com cotação ligada não pode ser criada sem cotação: a API pede para desligar o switch e informar o valor.
