# Campanha — Peregrinação Itália + Medjugorje (5 a 17 de abril de 2027)

**Estado:** pronta para dry run · nada foi enviado
**Criada em:** 2026-07-28
**Objetivo:** encher as vagas restantes da peregrinação de Itália + Medjugorje antes do prazo de inscrição (30 de novembro de 2026).

---

## 1. O produto (dados reais da base)

| Campo | Valor |
| --- | --- |
| Peregrinação | Peregrinação a Itália e Medjugorje — Abril 2027 |
| Datas | 5 a 17 de abril de 2027 (13 dias) |
| Roteiro | Roma · Cássia · Perúgia · Assis · Loreto · Lanciano · San Giovanni Rotondo · Monte Gargano · Pompeia · Medjugorje |
| Terrestre (sem voo) | 1.850 € por pessoa |
| Inscrição (depósito) | 500 € |
| Parcelamento | até 10x sem juros (PIX/BR, cartão, MBWAY/Multibanco, transferência) |
| Suplemento quarto individual | +950 € |
| Incluído | Hotel 4★ · alimentação completa · bebidas · transporte terrestre · transferes |
| Não incluído | Bilhetes de avião · seguro de viagem |
| Voos | PT e BR **obrigatoriamente** pelo pacote da agência (estimativa BR ~1.300 €); restantes países compram o próprio (chegada a Roma/FCO até 10:00 de 5 abr) |
| Prazo de inscrição | 30 de novembro de 2026 |
| Vagas | 65 no total · 23 livres · 42 ocupadas |

**Nota sobre a escassez:** a ocupação real é **65%** (42/65). Por decisão do Gabriel (2026-07-28) a campanha comunica **75%**, e o site foi alinhado ao mesmo número (`pricing_config.scarcity_fill_pct = 75` na peregrinação da Itália) para email e página nunca se contradizerem.

---

## 2. Audiência

**Regra:** toda a base de contactos, **exceto quem já está inscrito nesta peregrinação**.

Números do dry run de 2026-07-28:

| Grupo | Contactos |
| --- | --- |
| Contactos com email, sem unsubscribe/supressão | 1.111 |
| — endereços internos/não entregáveis | descartados por `isDeliverableMarketingEmail` |
| — já inscritos na Itália | 42 emails excluídos |
| **Audiência final** | **962** |
| → PT (email PT-BR) | 875 |
| → EN (email inglês, inclui os 19 contactos ES) | 87 |

**Exclusões aplicadas em cada corrida** (recalculadas, não congeladas):
1. Inscritos na Itália/Medjugorje — `pilgrims.email` das `bookings` desta peregrinação + email do titular da reserva (`auth.users`), qualquer estado exceto cancelado. Quem se inscrever a meio da campanha deixa automaticamente de receber os follow-ups.
2. `consent_state` em `suppressed` / `unsubscribed`.
3. Emails internos `@sem-email.local` e endereços não entregáveis.
4. Quem já recebeu **este** email da sequência (dedupe por `campaign_slug` em `marketing_message_logs`).
5. Quem recebeu qualquer email de marketing nas últimas 24h (regra global da casa) — fica para a corrida seguinte.

---

## 3. Sequência — 4 emails em 3 semanas

Cada email só vai a quem **não se inscreveu** entretanto. Os follow-ups (2, 3 e 4) só são enviados a quem **recebeu o email anterior**, para ninguém entrar a meio da história.

| # | Dia | Template | Ângulo | Assunto PT | Assunto EN |
| --- | --- | --- | --- | --- | --- |
| 1 | D0 | `italy_medjugorje_launch` | Anúncio + roteiro + escassez | Itália e Medjugorje 2027: 75% das vagas já foram | Italy and Medjugorje 2027: 75% of the places are gone |
| 2 | D+4 | `italy_medjugorje_story` | Porquê esta viagem: Padre Pio ↔ Garabandal ↔ Medjugorje + testemunhos | O Padre Pio viu Garabandal antes de morrer | Padre Pio saw Garabandal before he died |
| 3 | D+9 | `italy_medjugorje_value` | Preço, 10x sem juros, o que está incluído, objeções | 1.850 € com tudo incluído — e dá para parcelar em 10x | €1,850 all-in — and you can split it into 10 |
| 4 | D+16 | `italy_medjugorje_last_call` | Última chamada + prazo 30 nov 2026 | Últimas vagas para Itália e Medjugorje | Final places for Italy and Medjugorje |

Nota de copy: nenhum email promete a vaga por um valor de entrada ("garanta a sua vaga com 500 €"). A entrada aparece apenas na tabela de preços, como "Inscrição (entrada)", e o CTA do email 3 é *Ver Valores e Fazer a Minha Inscrição*.

**Porquê esta ordem:** desejo (1) → confiança (2) → remoção da objeção financeira, que é a maior (3) → urgência com prazo real (4). O prazo do email 4 não é inventado: 30 de novembro de 2026 é a data limite de inscrição que consta na base.

---

## 4. O que cada email tem (widgets)

Todos usam o template da casa (cabeçalho dourado, bloco de ajuda + WhatsApp, unsubscribe, UTM automático) com a **capa real da peregrinação** como imagem de topo (PT usa `cover_image`, EN usa `cover_image_en`).

- **Barra de escassez** — cartão creme com barra dourada preenchida a 75%. É deliberadamente claro: o CSS de dark mode do `Layout` força `div/span/td` para a cor de texto, o que tornaria um cartão escuro ilegível nos clientes em modo escuro.
- **Widget de roteiro** — os 10 destinos em cartões, com Roma → Medjugorje.
- **Cartão de preço** — 1.850 € terrestre, inscrição (entrada), parcela mensal, suplemento individual. **Sempre em EUR com a conversão ao lado**: BRL nos emails PT, USD nos emails EN, marcada como aproximada (câmbio do dia via Frankfurter, com fallback BRL 6,15 / USD 1,08 se a API falhar). Os valores cobrados são em euros — a conversão é só leitura.
- **Incluído / não incluído** — duas colunas, honesto quanto aos voos.
- **Painel de prazo** — 30 de novembro de 2026.
- **Testemunhos reais** — vindos da tabela `testimonials` (nunca inventados).
- **CTA duplo** — botão dourado para a página + botão WhatsApp.

---

## 5. Mecânica de envio

Script: `scripts/send-italy-campaign.ts`

```bash
# 1) Dry run — mostra a audiência real e grava previews PT+EN. Não envia nada.
npx tsx scripts/send-italy-campaign.ts launch

# 2) Enviar um lote (defeito 300; correr em dias seguidos retoma onde ficou)
SEND=1 npx tsx scripts/send-italy-campaign.ts launch
SEND=1 MAX_SENDS=200 npx tsx scripts/send-italy-campaign.ts story
```

Passos: `launch` · `story` · `value` · `last-call`.

Previews no browser: `emails/_preview-italy-index.html` (as 8 versões numa só página).

**Ritmo sugerido para os 875 PT:** 300/dia em 3 corridas (o teto por corrida é `MAX_SENDS`, e a regra de 1 email/24h por contacto impede duplicados). Os 87 EN entram nas mesmas corridas.

Cada corrida regista tudo em `marketing_campaigns` + `marketing_message_logs`, pelo que o painel de marketing do admin mostra enviados, falhados e restantes.

---

## 6. Automação no Railway

O calendário está em código (`ITALY_SCHEDULE`, em `src/lib/italy-campaign.ts`) e o cron limita-se a perguntar "há alguma corrida marcada para agora?". Se não houver, não faz nada — **a campanha termina sozinha** no fim do calendário, sem ninguém ter de desligar o cron.

### Serviços de cron a criar (2)

Comando de ambos: `npm run cron:italy-campaign`

| Serviço | Schedule (UTC) | Hora de Lisboa |
| --- | --- | --- |
| `italy-campaign-tarde` | `0 13 * * *` | 14:00 |
| `italy-campaign-noite` | `0 20 * * *` | 21:00 |

Correm todos os dias de propósito: quem decide os dias é o calendário em código, e assim não há risco de o cron e o calendário ficarem dessincronizados se as datas mudarem. Nos dias sem corrida marcada a resposta é `{"skipped": true, "reason": "no_schedule_entry"}`.

Variáveis de ambiente (as mesmas dos crons que já existem): `CRON_SECRET`, `CRON_TARGET_URL` (ou `APP_URL`), `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Testar sem enviar

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://apostoladodegarabandal.com/api/cron/italy-campaign?dryRun=1"

# forçar um passo específico, ainda sem enviar
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://apostoladodegarabandal.com/api/cron/italy-campaign?dryRun=1&step=story&max=10"
```

### Salvaguardas da corrida automática

- **Fora do calendário não envia.** Também não envia fora da janela de 9h–21h de São Paulo.
- **Orçamento de tempo:** cada corrida para aos 4 minutos e deixa o resto para a seguinte (o cliente HTTP do cron desiste aos ~5 min). Ninguém fica por enviar — apenas passa para o lote seguinte.
- **Repetições são inofensivas:** se o Railway repetir uma corrida, o dedupe por `campaign_slug` faz com que ninguém receba duas vezes.
- **Inscritos entretanto:** a exclusão é recalculada em cada corrida, por isso quem se inscrever a meio deixa de receber os follow-ups.
- **Travão de emergência:** basta pausar os dois serviços de cron no Railway. Para cancelar de vez, apagar as linhas restantes de `ITALY_SCHEDULE` e fazer deploy.

## 7. Horários e calendário de envio

### Onde está a audiência

| País | Contactos | Nota |
| --- | --- | --- |
| Brasil | 306 | maior grupo identificado |
| Portugal | 163 | |
| Estados Unidos | 28 | 22 PT + 6 EN |
| Sem país registado | 537 | 453 PT + 65 EN + 19 ES — na prática, sobretudo importados do Sender (base brasileira) |

Ou seja: **quem manda no horário é o Brasil**, com Portugal em segundo. Os EUA são 3% — não vale distorcer o horário por eles, mas o horário escolhido serve bem a costa leste.

### Horário recomendado

| Hora de envio | São Paulo | Nova York | Los Angeles | Avaliação |
| --- | --- | --- | --- | --- |
| **14:00 Lisboa** | 10:00 | 09:00 | 06:00 | **principal** — meio da manhã no Brasil e início de manhã em NY, os dois picos de abertura |
| **21:00 Lisboa** | 17:00 | 16:00 | 13:00 | **segunda corrida do mesmo dia** — fim de tarde no Brasil |
| 13:00 Lisboa | 09:00 | 08:00 | 05:00 | boa alternativa, ligeiramente mais cedo |
| Antes das 12:00 Lisboa | madrugada | madrugada | noite | **evitar** — chega de madrugada ao Brasil |

Duas corridas por dia (14:00 e 21:00) são seguras: a regra de 1 email/24h por contacto garante que a corrida da noite pega em contactos diferentes da corrida da tarde.

**Dias:** terça, quarta e quinta. Evitar sábado, e domingo só como teste. Para ondas mais tarde no ano, evitar 7 set, 12 out, 2 nov e 15 nov (feriados no Brasil).

**Horário de verão:** até 25 de outubro de 2026, Lisboa está a UTC+1 e a diferença para São Paulo é de 4h. Depois dessa data a diferença passa a 3h — nessa altura, enviar às **13:00** de Lisboa para manter as 10:00 no Brasil.

### Warm-up obrigatório

O domínio nunca enviou mais de ~23 emails num dia (histórico em `marketing_message_logs`). Saltar para 300/dia arrisca ir para spam e queimar a reputação do domínio. Por isso o primeiro email sobe em rampa:

| Dia | Hora(s) | `MAX_SENDS` | Total do dia |
| --- | --- | --- | --- |
| Dia 1 | 14:00 | 100 | 100 |
| Dia 2 | 14:00 · 21:00 | 100 + 100 | 200 |
| Dia 3 | 14:00 · 21:00 | 150 + 150 | 300 |
| Dia 4 em diante | 14:00 · 21:00 | 160 + 160 | 320 |

### Calendário concreto (todas as horas de Lisboa)

| Email | Corridas | `MAX_SENDS` por corrida |
| --- | --- | --- |
| 1 · Lançamento | Ter 28/7 14:00 · Qua 29/7 14:00+21:00 · Qui 30/7 14:00+21:00 · Ter 4/8 14:00+21:00 | 100 · 100+100 · 150+150 · 200+162 |
| 2 · Padre Pio | Qua 5/8 · Qui 6/8 · Ter 11/8 (14:00+21:00) | 160+160 cada |
| 3 · Preço | Qua 12/8 · Qui 13/8 · Ter 18/8 (14:00+21:00) | 160+160 cada |
| 4 · Última chamada | Qua 19/8 · Qui 20/8 · Ter 25/8 (14:00+21:00) | 160+160 cada |

O espaçamento real por pessoa fica em ~6 a 8 dias entre emails (em vez dos D+4/D+9/D+16 teóricos), porque cada email leva 3 dias a sair. Para uma base que nunca recebeu este volume, esse ritmo mais calmo é uma vantagem, não um problema — e termina a 25 de agosto, três meses antes do prazo de 30 de novembro. Sobra espaço para uma onda de reativação em setembro/outubro para quem abriu e não se inscreveu.

**Sobreposição de passos não é problema:** o script só manda o email 2 a quem já recebeu o 1, e nunca manda dois emails ao mesmo contacto em 24h. Podem-se correr passos diferentes no mesmo dia sem risco.

## 8. O que medir

| Métrica | Onde | Alvo |
| --- | --- | --- |
| Entregues / bounces | Resend + `marketing_message_logs` | bounce < 3% |
| Cliques para a página | GA/PostHog, `utm_campaign=italy_medjugorje_*` | > 6% dos entregues |
| Inscrições iniciadas | `bookings` criadas após D0 | 20+ |
| Inscrições confirmadas | `bookings.status = confirmed` | 23 (esgotar) |
| Unsubscribes | `marketing_contacts.consent_state` | < 1% por email |

Atribuição: cada email leva `utm_campaign` próprio (`italy_medjugorje_launch`, `_story`, `_value`, `_last_call`), por isso dá para ver qual dos quatro converte.

---

## 9. Regras respeitadas

- Copy PT em **português do Brasil**; "membro", nunca "sócio".
- Emails saem de `no-reply@`, por isso a copy nunca pede resposta — aponta sempre para WhatsApp ou `geral@apostoladodegarabandal.com`.
- Testemunhos são reais (tabela `testimonials`), nunca inventados.
- Nada do fluxo de pagamento foi tocado — a campanha só lê dados e envia email.
- ES recebe a versão EN por decisão explícita desta campanha (a regra geral continua a ser ES fora de envios).
