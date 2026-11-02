# Registo de mudanças e experiências de conversão

Cada mudança que pode afetar as inscrições fica registada aqui **antes** de ir para produção, com a hipótese e a métrica. A revisão mensal começa sempre por avaliar as entradas "em curso" e só depois propõe mudanças novas. Sem este registo não conseguimos saber o que resultou.

Regras:
- No máximo 1 ou 2 mudanças por mês na mesma zona (página, formulário, emails). Com mudanças a mais ao mesmo tempo não se sabe qual resultou.
- Avaliar com janelas de 4 semanas antes e depois, nunca de uma semana para a outra.
- Com amostras pequenas (menos de 30 pessoas numa etapa), o resultado é "inconclusivo". Não se declara vitória.
- Resultado possível: ✅ manter · ❌ reverter · ⏸ inconclusivo (prolongar ou repensar).

## Formato

```
### AAAA-MM-DD · título curto
- Estado: em curso | avaliada (✅/❌/⏸) | proposta
- Zona: página | formulário | emails | chat | dados
- Hipótese: se <mudança>, então <métrica> sobe/desce porque <razão ligada aos dados>.
- Métrica principal: <etapa do funil ou taxa> · Valor de partida: <número, janela, n>
- Onde: <ficheiros / template / branch / commit>
- Avaliar a partir de: <data, ~4 semanas depois>
- Resultado: <preencher na avaliação, com números>
```

## Entradas

### 2026-11-02 · Tracking próprio do site e painel de conversão
- Estado: em curso (medição, não é experiência)
- Zona: dados
- O que é: começa a medição de todas as visitas (`site_events`), do funil por peregrinação e da pontuação de interesse. Não há valores anteriores para comparar: as primeiras 4 semanas servem de linha de partida.
- Onde: `src/lib/site-tracker.ts`, `/api/m`, `/admin/conversao`, migrações `20261102120000` e `20261102150000`.
- Avaliar a partir de: 2026-11-30 (confirmar que o funil bate certo com as inscrições reais em `bookings`).

### 2026-11-02 · Correção do funil de "inscrição abandonada"
- Estado: em curso (correção de erro)
- Zona: emails
- O que mudou: o segmento `abandoned-registration`, o objetivo `booked_pilgrimage` e a condição `not_booked` passam a contar também os registos em `pilgrims`. O lead passa a `converted` quando a pessoa se inscreve. Pausadas 8 sequências ativas de pessoas já inscritas.
- Valor de partida: 58 emails de abandono enviados a pessoas inscritas (34% dos envios), 15 nos últimos 30 dias.
- Métrica: emails de abandono enviados a quem já é peregrino. Tem de passar a 0.
- Onde: `src/lib/marketing-core.ts` (`hasBookedPilgrimage`), `src/lib/marketing-automation-engine.ts`, `src/app/api/booking/create/route.ts`.
- Avaliar a partir de: 2 semanas depois do deploy.

### 2026-11-02 · Primeiro email de abandono adaptado ao passo (proposta)
- Estado: proposta (texto pronto no renderer; falta voltar a ligar o motor de funis, retirado no 2ec2701, depois de o texto ser aprovado)
- Zona: emails
- Hipótese: se o primeiro email falar do passo onde a pessoa parou (dados, quartos, voos, pagamento), então mais pessoas voltam a concluir, porque a mensagem responde à dúvida concreta.
- Métrica principal: % de quem recebe `abandoned_registration_1` e se inscreve em 14 dias. Valor de partida: cerca de 20% (11 de 49, contando só quem ainda não estava inscrito, até 2026-11-02).
- Avaliar a partir de: 6 semanas depois de ligar (o volume é baixo, cerca de 10 envios por mês).

## Ideias à espera de vez (do estudo de base)

- Destacar "vai sozinha? partilha quarto com outra peregrina" na página (77% das inscrições são individuais).
- Política de cancelamento e da taxa escrita de forma simples, também em inglês (14 conversas no chat sobre isto).
- Preço em dólares e voos a partir dos EUA explicados na página em inglês (EUA = 43% da Mariana 2027).
- Pergunta opcional "Como conheceu esta peregrinação?" no fim da inscrição.
- Perceber porque desistem os portugueses (38% de conclusão contra 62–78% noutros países).
