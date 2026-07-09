# Auditoria de Crescimento — Sistema de Email & Marketing

> **Data:** 2026-07-09 · **Âmbito:** todo o sistema de email automatizado + marketing (funis, templates, newsletter, campanhas, medição).
> **Método:** leitura do código real + queries **read-only** à BD de produção (`pntzzuxzjnzksubbjfvj`). Nada foi alterado.
> **Supersede parcialmente:** `MARKETING_SYSTEM.md` (2026-07-02) continua válido como livro de regras; este documento adiciona o diagnóstico de crescimento e o plano. Drift assinalado na secção 2.
> **Regra de ouro desta auditoria:** uma recomendação que aumenta receita mas barateia o tom espiritual é uma recomendação **reprovada**.

---

## 1. Sumário executivo

- **O motor está são e conservador** — deduplicação de contactos, caps (1/dia por contacto, 50/dia globais), prioridade entre funis, pausa `left_segment`, unsubscribe RFC 8058. A infraestrutura não é o problema.
- **O maior ativo está parado:** 876 subscritores opt-in explícito (827 PT + 49 EN) importados a 2026-07-02 e **nenhuma edição da newsletter foi enviada**. Pior: os dois únicos emails em massa que essa lista recebeu foram **comerciais** (anúncio do site 297 a 24/06 + flash sale de livros 965 a 02/07). A lista foi acordada com dois pedidos e zero "dar". Este é o risco nº 1 de confiança e a oportunidade nº 1 de crescimento.
- **Medição = zero além de contagens de envio.** Não há webhook do Resend (aberturas, cliques, bounces, spam-complaints não existem em lado nenhum) e **nenhum CTA de email tem UTM**. Hoje é impossível dizer se qualquer email "funcionou". Sem isto, todas as decisões futuras são às cegas.
- **Metade do catálogo nunca foi usada:** 14 dos 31 templates de marketing têm **0 envios all-time** — incluindo toda a família de doações (`donation_thank_you`, `donation_thank_you_story`, `donor_to_member`), a de brochura, a de lead→membro e `store_book_recommendation`. O sistema pede (recuperação, referral, flash sale) muito mais do que dá.
- **Referral: 315 emails enviados, 0 conversões.** `referral_activation` + `share_mission` = 315 envios; os emails de recompensa (`referral_reward_*`, disparados no pagamento com código) nunca dispararam uma única vez. O programa não converte — precisa de redesenho, não de mais envios.
- **Bug real de copy × segmento no funil de renovação (draft):** o segmento é `expirado` (quota já venceu), mas o `membership_renewal` diz "faltam poucos dias para manter seu lugar" / "está prestes a vencer" — copy de pré-vencimento. Ativar como está violaria a regra de verificação segmento × copy.
- **3 jogadas de maior alavancagem:** (1) instrumentar Resend webhook + UTM antes de tudo; (2) lançar a newsletter mensal com artigos reais do site (o "dar" que a lista nunca recebeu) com envio em lotes; (3) ligar a família de doações (obrigado → história de impacto → convite a membro) que já está escrita e nunca enviou.
- **Upside honesto (intervalos, dados finos):** newsletter mensal a 876 subs ≈ 220–390 aberturas e 25–70 visitas engajadas/edição (assumindo 25–45% open e 3–8% CTR em lista warm — **não medível até haver webhook**); doador→membro: 13 contactos hoje, fluxo completo pode render 1–4 membros/trimestre (€25/ano cada); loja via recomendação editorial (não flash): 1–5 vendas/mês é realista, mais estável que picos de promoção. Ninguém deve esperar múltiplos de receita — o ganho composto é **confiança + lista viva + dados**.

---

## 2. Mapa as-built (segmentos → funis → templates → cron → limites)

### 2.1 Pipeline

```
11 fontes (membros, booking_leads, waitlists, bookings, pilgrims, pilgrimage_payments,
           donations, store_orders, pagamentos_quotas, newsletter_subscribers, suppression)
   └─ buildMarketingContacts()            src/lib/marketing-data.ts:161
        └─ marketing_contacts (1.099 rows · 892 explicit · 196 assumed · 11 unsub/suppressed)
             └─ evaluateMarketingSegments()  src/lib/marketing-core.ts:274
                  └─ marketing_funnels (5 ativos · 1 draft · 1 pausado)
                       └─ marketing_enrollments → processMarketingEnrollment()
                            src/lib/marketing-automation-engine.ts:464
                            └─ sendMarketingEmail() (Resend) + marketing_message_logs
```

Cron: `/api/cron/marketing-automations` (Railway, a cada 15 min via `scripts/railway-cron.mjs`), ordem: cap diário → auto-inscrição → `waitlist_open_spot` → enrollments devidos ordenados por `lead_score` → valor → `next_run_at` ([route.ts:25-32](../src/app/api/cron/marketing-automations/route.ts)).

### 2.2 Segmentos (contagens reais, 2026-07-09)

| Segmento | Regra (marketing-core.ts:274-302) | Contactos | Funil |
|---|---|---:|---|
| newsletter-pt | subscritor + língua PT | **827** | ⚪ nenhum (newsletter mensal, nunca enviada) |
| members-without-referrals | membro com 0 referrals | ~174 | ✅ referral (após onboarding) |
| abandoned-registration | lead sem waitlist/reserva | ~71 | ✅ recovery |
| past-pilgrims | reservou ou peregrinou | ~47 | ⚪ silêncio deliberado |
| newsletter-en | subscritor + língua EN | **49** | ⚪ nenhum |
| high-value-supporters | valor total ≥ €100 | ~40 | ⚪ silêncio deliberado |
| waitlist-contacts | em lista de espera | ~25 | ✅ waitlist-nurture |
| new-members | membro ≤14 dias | ~14 | ✅ onboarding |
| donors-not-members | doou, não é membro | **13** | ✅ donor-to-member (1 email só) |
| hot-pilgrimage-leads | score ≥70 + lead sem reserva | 5 | ⚪ (subconjunto do recovery) |
| expired-members | quota `expirado` apenas | **1** | 📝 draft renewal |
| brochure-requested-not-booked | pediu brochura, sem reserva | 0 | ⚪ vazio |
| newsletter (ES) | 19 subscritores ES | 19 | 🔒 excluídos de tudo (correto — sem copy ES) |

### 2.3 Funis (estado real na BD, 2026-07-09)

| Funil (slug) | Estado | Passos (template +delay) | Enrollments |
|---|---|---|---|
| member-onboarding | ativo | member_welcome 0h → pray_intentions +96h → novena +216h → learn +384h | 18 ativos, 5 completos |
| waitlist-nurture | ativo | welcome 0h → garabandal_story +72h → book_recommendation +168h → mission_support +336h → member_invitation +576h | 25 ativos, 1 completo |
| abandoned-registration-recovery | ativo | 3× recuperação (+1h/+48h/+120h), `not_booked`+`has_availability` | 3 ativos, 41 completos, 50 stopped |
| donor-to-member | ativo | member_invitation +72h (`not_member`) | 1 ativo, 15 completos |
| member-referral-activation | ativo | referral_activation +72h → share_mission +336h; espera o onboarding | 12 ativos, 156 completos |
| member-renewal-support | **draft** | membership_renewal 0h | 17 stopped (envio de 29/05, segmento antigo) |
| waitlist-conversion | pausado (legado) | — | 24 completos (histórico) |

### 2.4 Envios (verdade da BD)

- **All-time `sent`: 1.941** · falhas 90d: **2** (boa fiabilidade técnica de envio).
- Últimos 30 dias: **1.381 sent**, dos quais **965 = flash sale (1 dia, 02/07)** e **297 = site_announcement (24/06)**. Orgânico dos funis ≈ **119/mês** (~4/dia).
- **Templates com 0 envios all-time (14):** `brochure_followup_1`, `pilgrimage_testimony`, `pilgrimage_faq_objections`, `waitlist_open_spot`, `waitlist_book_recommendation`, `waitlist_mission_support`, `waitlist_member_invitation`, `payment_support`, `donation_thank_you`, `donation_thank_you_story`, `donor_to_member`, `store_book_recommendation`, `lead_to_member_welcome`, `lead_to_member_followup`, `member_referral_activation`, `referral_reward_inviter`, `referral_reward_invitee`.
  (Nota: `waitlist_book_recommendation`/`mission_support`/`member_invitation` estão em passos futuros do funil novo — vão disparar; os restantes estão órfãos.)
- Templates fora do catálogo usados por script: `site_announcement_2026` (297), `auction_announcement` (97) — o announcement **não** ficou registado em `marketing_campaigns` (só a flash sale tem linha).

### 2.5 Limites ([marketing-limits.ts:8-15](../src/lib/marketing-limits.ts))

1/24h por contacto · 7/7d · 15 por corrida · **50/dia global** · 100 por campanha — todos ajustáveis por env var (tetos hard: 500/dia, 500/campanha).

### 2.6 Drift vs docs existentes

| Doc | Estado | Drift |
|---|---|---|
| `MARKETING_SYSTEM.md` (07-02) | ✅ fiável | Contagens ligeiramente desatualizadas (contactos 1.086→1.099; expired-members ~15→**1**). Confirma-se que o deploy das regras novas já está em vigor (waitlist_garabandal_story a enviar desde 04/07). |
| `MARKETING_FUNNEL_STRATEGY.md` (06-30) | ⚠️ parcial | Fases descritas como futuras já parcialmente feitas (fusão waitlist). Continua útil como visão. |
| `MARKETING_EMAIL_FLOW.md` | ⚠️ desatualizado | Diz "Doador para membro: `donor_to_member`, tarefa manual" — na BD o passo usa `member_invitation` e as tarefas manuais foram removidas. Diz "Referral: `referral_activation`" — correto, mas o template `member_referral_activation` do catálogo ficou órfão. |
| `EMAIL_SYSTEM.md` | ⚠️ desatualizado | Refere Stripe como webhook de pagamentos; o fluxo atual é Reduniq. Não cobre os emails de marketing. Diz "Abandonment Recovery ~15m/30m" — o funil real é +1h/+48h/+120h. |
| `HANDOFF_MARKETING.md` | ✅ contexto | Guardrails corretos (apex domain, WhatsApp em vez de reply-to). |

---

## 3. Diagrama do ciclo de vida (onde a jornada vaza)

```
Visitante
   │  formulários: inscrição / waitlist / brochura / newsletter
   ▼
Lead peregrinação (71 abandoned + 25 waitlist + 0 brochura)
   │  ✅ recovery 3 emails    ✅ waitlist 5 emails
   │  ❌ brochura: captura existe (api/leads/capture) mas 0 leads e funil nunca criado
   ▼
Subscritor newsletter (876)  ◄── LATERAL: maior audiência, entra por opt-in
   │  ❌ ZERO edições enviadas; só recebeu 2 emails comerciais
   │  ❌ nenhum caminho subscritor→membro (deliberadamente adiado, mas a newsletter
   │     mensal — o pré-requisito — também não saiu)
   ▼
Membro (169 · 14 novos)
   │  ✅ onboarding 4 emails (espiritual, bom)
   │  ✅ referral 2 emails → ❌ 0 conversões em 315 envios
   │  ⚠️ renovação: draft com copy errada; expirados hoje = 1
   ▼
Doador (13 donors-not-members; 124 doações succeeded all-time)
   │  ⚠️ recibo transacional ✓, mas donation_thank_you / thank_you_story NUNCA enviados
   │  ⚠️ primeiro toque de marketing ao doador é um PEDIDO (member_invitation +72h)
   ▼
Peregrino (47 past-pilgrims) — silêncio deliberado ✓ (decisão registada)
   ▼
Advogado/Referral — ciclo morto (0 recompensas pagas alguma vez)
```

**Vazamentos principais:** (a) newsletter parada = 80% da lista sem nenhum toque de valor; (b) doador tratado como alvo de conversão antes de ser agradecido com história real; (c) referral com esforço alto e retorno zero; (d) nenhum email do sistema aponta para os 102 artigos PT publicados (só `waitlist_garabandal_story` → `/historia`).

---

## 4. Scorecard (1–5)

Tom = reverência/pastoral · Valor = "dá" antes de pedir · Conv = mecânica de conversão · Alvo = segmento×copy · Deliv = consentimento/caps · Med = medição.

| Fluxo / template | Tom | Valor | Conv | Alvo | Deliv | Med | Veredito |
|---|--:|--:|--:|--:|--:|--:|---|
| member-onboarding (4 emails) | 5 | 5 | 4 | 5 | 5 | 1 | O melhor fluxo do sistema; só falta saber se é aberto. |
| waitlist-nurture (5 emails) | 5 | 4 | 4 | 5 | 5 | 1 | Bem desenhado (dar→dar→pedir suave); story podia linkar artigos reais além de `/historia`. |
| abandoned-registration-recovery | 4 | 2 | 4 | 4 | 5 | 1 | Honesto ("último email" cumpre-se), mas 3 pedidos seguidos sem nenhum "dar"; latente: brochura cairia aqui com copy errada (ver F7). |
| donor-to-member (1 email) | 4 | 2 | 3 | 4 | 5 | 1 | Pede antes de agradecer; a família donation_* escrita e nunca ligada. |
| member-referral (2 emails) | 4 | 2 | 2 | 4 | 5 | 1 | 315 envios, 0 conversões — mecânica €2,50 não move ninguém. |
| membership_renewal (draft) | 4 | 2 | 3 | **1** | 5 | 1 | Copy de pré-vencimento num segmento de já-expirados. Não ativar sem reescrever. |
| store_book_flash_sale (campanha) | 3 | 2 | 4 | 2 | **2** | 2 | Urgência real mas foi o 2º email comercial em 8 dias a uma lista que nunca recebeu valor; 965 num dia fora de todos os caps. |
| site_announcement_2026 (campanha) | 4 | 3 | 3 | 3 | 3 | 1 | Legítimo, mas fora de `marketing_campaigns` (sem rasto no admin). |
| waitlist_open_spot (auto) | 5 | 4 | 5 | 5 | 5 | 1 | Código sólido, dedupe por peregrinação; **0 disparos all-time** — verificar no próximo ciclo de vagas. |
| donation_thank_you / _story | 5 | 4 | 4 | 5 | 5 | 1 | Escritos, reverentes, prontos — **nunca enviados**. |
| lead_to_member_welcome / followup | 5 | 4 | 4 | 4 | 5 | 1 | A melhor copy de conversão do catálogo (intenção de oração); órfã. |
| Newsletter mensal | — | — | — | — | — | — | **Não existe.** A página admin é informativa, sem compositor nem envio. |

---

## 5. Findings (evidência → impacto → severidade → guardrail)

**F1 — Zero medição de engagement.** Não existe webhook Resend (só `reduniq` em `src/app/api/webhooks/`); `marketing_message_logs` guarda apenas sent/failed/skipped; `marketing_events` só tem eventos de fonte (nenhum `email_opened`/`clicked`). Nenhum CTA tem UTM (`grep utm src/lib/email-renderer.ts` → 0). **Impacto:** impossível avaliar qualquer copy, funil ou campanha; o scorecard acima não pode ter coluna Med > 2. **Severidade: ALTA.** Guardrail: medição honesta.

**F2 — Newsletter opt-in parada e "queimada" com pedidos.** 876 subs explícitos desde 02/07; zero edições; os únicos toques em massa foram `site_announcement_2026` (24/06, 297) e `store_book_flash_sale` (02/07, 965). **Impacto:** o primeiro contacto pós-import foi comercial — risco direto de unsubscribes/spam-complaints invisíveis (ver F1) e de erosão de confiança pastoral. **Severidade: ALTA.** Guardrails: dar antes de pedir; consentimento.

**F3 — Envios em massa contornam todos os caps e (parcialmente) o registo.** 965 envios num dia = 19× o cap global de 50/dia; `site_announcement_2026` nem sequer tem linha em `marketing_campaigns` (pendente já apontado em MARKETING_SYSTEM.md §Pendente). **Impacto:** os limites anti-spam só valem para o cron; qualquer script fura. **Severidade: ALTA.** Guardrail: send limits.

**F4 — Renovação: copy × segmento errados.** Segmento `expired-members` = quota **já expirada** ([marketing-core.ts:291](../src/lib/marketing-core.ts)); template diz "Sua anuidade está **prestes a vencer**" / subject "faltam poucos dias" ([email-renderer.ts:2588-2599](../src/lib/email-renderer.ts)). Histórico: 15 envios a 29/05 sob o segmento antigo. **Impacto:** hoje só 1 contacto, mas ativar assim quebraria a regra de verificação obrigatória. **Severidade: MÉDIA (bloqueante para ativação).** Guardrail: renewal targeting.

**F5 — Família de doações nunca ligada.** `donation_thank_you`, `donation_thank_you_story`, `donor_to_member`: 0 envios all-time; o funil donor-to-member usa `member_invitation` +72h como primeiro e único toque. **Impacto:** doador recebe recibo frio e depois um pedido — inverte a lógica dar→pedir; perde-se a melhor janela de relação (pós-generosidade). **Severidade: MÉDIA-ALTA.** Guardrail: tom pastoral.

**F6 — Referral morto apesar do volume.** 159 `referral_activation` + 156 `share_mission` enviados; `referral_reward_*` (disparados em [payment-handlers.ts:105-137](../src/lib/payment-handlers.ts) quando alguém adere com código) **nunca dispararam** → 0 adesões por convite, alguma vez. **Impacto:** 315 emails de pedido sem fruto; o incentivo €2,50 é fraco e o funil re-pede a 174 membros. **Severidade: MÉDIA.** Guardrail: não sobre-pedir.

**F7 — Bug latente de segmentação: brochura cai em "abandonou inscrição".** [marketing-data.ts:235](../src/lib/marketing-data.ts): qualquer `booking_leads.status` ≠ `waitlist`/`interested` incrementa `leads` — incluindo `brochure_request`. Um pedido de brochura entraria no funil recovery com copy "sua inscrição ficou quase pronta" (falsa). Hoje 0 brochuras, por isso dormente. Bónus: [linha 253](../src/lib/marketing-data.ts) conta o mesmo lead 2× quando `step_reached ≥ 2` (inflaciona `leads`, inofensivo mas sujo). **Severidade: MÉDIA (latente).** Guardrail: segmentação correta.

**F8 — PT-PT residual em templates de marketing.** Exemplos: `donation_thank_you` "interceda **por si** e pela sua família"; `donor_to_member` "gostaríamos de **lhe** apresentar"; `waitlist_open_spot` "**Estamos a entrar** em contato"; `waitlist_more_spots` (CTA WhatsApp) "**gostava** muito de ser considerado(a)" ([email-renderer.ts:2318](../src/lib/email-renderer.ts)). **Impacto:** inconsistência de voz para audiência maioritariamente brasileira. **Severidade: BAIXA-MÉDIA.** Guardrail: PT-BR.

**F9 — Nenhum email aponta para os artigos.** 102 posts PT publicados (`posts`, servidos em `/l/{slug}`) + 5 cornerstones (`/a-historia-de-garabandal`, `/o-futuro-milagre`, `/o-padre-pio`, `/as-mensagens`, `/ensinamentos`); único link de conteúdo em todo o catálogo é `waitlist_garabandal_story` → `/historia`. **Impacto:** perde-se o "dar" mais barato que existe (conteúdo já escrito) e o empurrão SEO de tráfego engajado a páginas sub-indexadas. **Severidade: MÉDIA.** Guardrail: content value.

**F10 — Vocabulário no site (afeta o que os emails podem linkar).** Post publicado `faca-se-socio-da-nossa-associacao-do-apostolado-de-garabandal` ("Faça-se **SÓCIO**…") viola o vocabulário "membro" na superfície pública. Nenhum email deve linkar esta página até correção/redirect. **Severidade: BAIXA (mas visível).** Guardrail: vocabulário.

**F11 — `waitlist_open_spot` nunca disparou.** 0 all-time apesar do código robusto. Provavelmente nunca houve `current_vacancies > 0` num momento com waitlist ativa — mas sem prova. **Ação: correr `?dryRun=1` quando abrir a próxima vaga** e confirmar candidatos. **Severidade: BAIXA (verificação).**

**F12 — Sem janela de envio (quiet hours).** O cron corre 24/7 e nada em `marketing-limits.ts` restringe hora local — um email pode sair às 3h da manhã do Brasil. **Severidade: BAIXA.**

---

## 6. Recomendações (Impacto × Esforço, priorizadas)

**R1 — Instrumentar antes de otimizar (Impacto ★★★★★ · Esforço S-M).**
Webhook Resend (`email.opened`, `email.clicked`, `email.bounced`, `email.complained`) → gravar em `marketing_message_logs.metadata` ou novas linhas em `marketing_events` (`email_opened`…), ligando por `provider_message_id` (já guardado). Bounces/complaints alimentam `marketing_suppression_list` automaticamente. Em paralelo, acrescentar UTM a todos os `ctaUrl` no renderer (`utm_source=email&utm_medium={funnel|campaign}&utm_campaign={template_key}`) — mexe só em `marketingUrl()`/`fillMarketingVariables()` ([email-renderer.ts:2056](../src/lib/email-renderer.ts)). **Nada de novo se envia; tudo o que se envia passa a contar.** Guardrails: nenhum tocado.

**R2 — Lançar a newsletter mensal (Impacto ★★★★★ · Esforço M).**
É a dívida de valor para com a lista (F2) e o pré-requisito de tudo o resto. Formato aprovado nos docs: 3-4 artigos reais + 1 destaque. Ver secção 8 para a edição nº 1 proposta com posts reais. Mecânica de envio dentro dos guardrails: template novo `newsletter_monthly` no catálogo + script de lotes que grava em `marketing_campaigns` + `marketing_message_logs`, com env vars pontuais (`MARKETING_CRON_DAILY_SEND_CAP=300` durante 3 dias → 876 emails em 3 lotes, PT primeiro, EN no fim), respeitando supressão/unsubscribe e o cap 1/24h por contacto. **Aprovação explícita do Gabriel antes de cada lote.** Guardrails: consent ✓ (lista é 100% opt-in), ES excluído ✓, batching declarado ✓.

**R3 — Ligar a família de doações (Impacto ★★★★ · Esforço S).**
Novo funil `donor-nurture` (segmento `donors-not-members`, substitui o donor-to-member atual): `donation_thank_you` +24h → `donation_thank_you_story` +7d → `donor_to_member` +21d (cond `not_member`). Os 3 templates já existem e têm bom tom; rever PT-BR (F8) antes. O convite passa a chegar **depois** de dois gestos de gratidão. 13 contactos hoje + cada novo doador entra automaticamente. Guardrails: dar antes de pedir ✓; caps normais do cron ✓.

**R4 — Corrigir renovação antes de ativar (Impacto ★★★ · Esforço S).**
Reescrever `membership_renewal` para o estado real "a sua anuidade **expirou**" — tom de porta aberta, não de contagem decrescente. Direção de copy (PT-BR): *Subject:* "{{first_name}}, seu lugar na missão continua guardado" · *Corpo:* reconhecer que a anuidade venceu, dizer o que continua à espera dele (Missa ao vivo, novenas, velas), zero culpa, um clique para renovar. Só então ativar o draft. Hoje atinge 1 contacto — o valor é ter o fluxo correto para quando a base de membros envelhecer. Guardrail: renewal = `expirado` only ✓ (segmento já garante por código).

**F5→R5 — Repensar o referral em vez de re-enviar (Impacto ★★★ · Esforço M).**
Parar de tratar como funil de volume (F6). Mudanças: (a) reduzir a 1 email por membro/ano; (b) trocar o gancho de €2,50 por um gancho de missão+oração — o `member_referral_activation` órfão ("pense numa pessoa que precisa de paz") tem melhor psicologia que o atual; (c) medir com R1 antes de qualquer nova iteração. Guardrail: não sobre-pedir ✓.

**R6 — Política única de envios em massa (Impacto ★★★ · Esforço S).**
Toda a campanha por script: (1) linha em `marketing_campaigns` antes do envio; (2) log por destinatário em `marketing_message_logs` (a flash sale fez isto ✓); (3) máx. **1 campanha comercial por mês** à lista da newsletter e nunca nos 7 dias seguintes à edição mensal; (4) lotes ≤300/dia. Formalizar no `MARKETING_SYSTEM.md` §2.1. Guardrail: send limits ✓, tom ✓ (a cadência protege a reverência).

**R7 — Corrigir F7 (brochura → copy errada) (Impacto ★★ · Esforço XS).**
Em [marketing-data.ts:235](../src/lib/marketing-data.ts), excluir também `brochure_request` do incremento de `leads` (a brochura já tem contador próprio e segmento próprio). Remover o duplo-incremento da linha 253. Depois, se a captura de brochura voltar a ser usada, criar o funil `brochure-nurture` com os 3 templates órfãos (`brochure_followup_1` → `pilgrimage_testimony` → `pilgrimage_faq_objections`) — já escritos, bom tom, com `has_availability` implícito a acrescentar via `RECOVERY_REQUIRES_AVAILABILITY` se necessário.

**R8 — Varrer PT-PT dos templates (Impacto ★★ · Esforço S).** Lista mínima em F8; passar os 31 templates por revisão "por si→por você / lhe→para você / estamos a→estamos + gerúndio / gostava→gostaria". Só copy — nenhuma lógica.

**R9 — Quiet hours (Impacto ★ · Esforço S).** Janela 09:00–21:00 (America/Sao_Paulo) no cron para envios de marketing: se fora da janela, reagendar para a manhã seguinte. Opcional; o dano atual é estético.

**R10 — Corrigir o post "SÓCIO" (Impacto ★ · Esforço XS).** Retitular/editar o post PT (F10) ou 301 para `/tornar-membro`. Nenhum email linka páginas com "sócio".

---

## 7. Novos funis / emails a acrescentar

| Proposta | Trigger/segmento | Cadência | "Dar" espiritual | Artigo real a linkar | Objetivo | Fonte |
|---|---|---|---|---|---|---|
| **Newsletter mensal PT/EN** (R2) | `newsletter-pt` / `newsletter-en` | mensal | 3-4 artigos + oração do mês | ver §8 | lista viva → tráfego → membros | posts reais ✓ |
| **Donor-nurture** (R3) | `donors-not-members` | +24h/+7d/+21d | gratidão + história da Casa de Acolhimento | `/l/abencoada-peregrinacao-de-abril` (peregrinação Abr 2026) | doador→membro | post real ✓ |
| **Brochure-nurture** (R7, quando houver brochuras) | `brochure-requested-not-booked` | +24h/+4d/+9d | testemunho de peregrino | `/l/peregrinacao-e-palestra-em-garabandal-em-marco-2025` | brochura→inscrição | post real ✓ |
| **Lead→membro (campanha pontual, não funil)** | seleção manual de past-pilgrims/leads frios, aprovada 1-a-1 | 2 emails (+0/+5d) | intenção de oração (copy já existe: `lead_to_member_welcome/_followup`) | `/o-padre-pio` (cornerstone) | adesões | páginas reais ✓ |
| **Aniversários marianos** (13 de maio / 18 de junho / 16 de julho / 2 de julho N. Sra. do Carmo etc.) | newsletter-pt/en | 3-4×/ano, no dia | meditação da data + convite a rezar | `/l/a16-de-julho-de-1961-dia-de-nossa-senhora-do-carmo`, `/l/aniversario-da-aparicao-do-arcanjo-s-miguel` | relação; CTA suave (vela/novena para membros) | posts reais ✓ |

Nenhuma história inventada: todas as referências acima são slugs reais de `posts`/`wp_pages` publicados. Onde faltar testemunho brasileiro recente com nome, marcar **PLACEHOLDER — needs real source** e pedir ao Gabriel um post novo antes de usar.

---

## 8. Plano de surfacing de conteúdo (artigos reais → emails)

**URLs:** posts = `apostoladodegarabandal.com/l/{slug}` (EN: `/en/l/{slug}`) · páginas = `/{slug}`.

### Edição nº 1 da newsletter (proposta para aprovação)

Tema: *"Conhecer Garabandal do princípio"* — serve a maioria (subscritores antigos do Sender que nunca viram o site novo) e empurra cornerstones sub-indexados:

1. `/a-historia-de-garabandal` (cornerstone história — a porta de entrada)
2. `/l/o-padre-pio-esteve-em-garabandal` (testemunho forte, evergreen)
3. `/l/recentes-palavras-de-conchita` (voz da vidente, curiosidade alta)
4. `/l/abencoada-peregrinacao-de-abril` (vida atual do Apostolado — prova de missão viva)
5. Destaque: peregrinação aberta OU livro (1 só, no fim, secundário)

EN (49 subs): usar equivalentes EN dos mesmos temas (`/en/l/meeting-with-jacinta-gonzalez`, cornerstone EN da história, `/en/l/pilgrimage-to-garabandal-2019`) — há 109 posts EN publicados.

### Calendário editorial (6 meses, PT)

| Mês | Tema | Artigos (slugs reais) | Destaque |
|---|---|---|---|
| Jul 2026 | Conhecer Garabandal | ed. nº 1 acima | 16 Jul: N. Sra. do Carmo (`/l/a16-de-julho-de-1961-dia-de-nossa-senhora-do-carmo`) |
| Ago | As Mensagens | `/as-mensagens`, `/l/garabandal-e-a-nossa-subida-ao-ceu` | livro *Diário de Conchita* |
| Set | O Aviso | `/l/o-aviso-mundial-verdade-ou-ficcao`, `/l/a-paixao-de-jesus-e-o-grande-aviso-de-garabandal` | peregrinação outono |
| Out | O Milagre | `/o-futuro-milagre` (cornerstone), `/l/jacinta-quebra-silencio-sobre-o-fim-dos-tempos` | tornar-membro (suave) |
| Nov | Testemunhos | `/o-padre-pio`, `/l/novo-artigo-publicado-no-apostolado-resumo-da-entrevista-a-jacinta-gonzalez-em-2021` | Casa de Acolhimento (doação) |
| Dez | Advento/Natal | `/l/meditacao-do-evangelho-natal-do-senhor-e-reflexao-sobre-a-mensagem-de-garabandal` + série Advento | velas de intenções (membros) |

### Mapeamento funil → artigo (substituir CTAs genéricos)

| Passo | Hoje linka | Passar a linkar também |
|---|---|---|
| `waitlist_garabandal_story` | `/historia` | `/a-historia-de-garabandal` + `/l/recentes-palavras-de-conchita` |
| `member_learn_garabandal` | `/member/academy` | + 1 artigo público do mês (dá razão de clique a quem não abre a academy) |
| `donation_thank_you_story` | `/donations` | + `/l/abencoada-peregrinacao-de-abril` (prova de impacto) |
| `pilgrimage_testimony` (quando ativar brochura) | `/peregrinacoes` | + `/l/peregrinacao-e-palestra-em-garabandal-em-marco-2025` |

SEO: cada edição envia 200-400 visitas engajadas a 3-4 URLs — sinal de utilização real para páginas que o GSC mostra sub-indexadas (liga com o trabalho de indexação já em curso).

---

## 9. Plano de medição

**KPIs por estágio (mínimo viável, tudo possível após R1):**

| Estágio | KPI | Fonte |
|---|---|---|
| Lista | crescimento líquido/mês; % bounces+complaints (<0,5%) | webhook Resend → suppression |
| Newsletter | open rate (meta 25-45%), CTR (3-8%), unsubscribes/edição (<1%) | webhook + UTM no GA/GSC |
| Funis | conversão por funil: recovery→booking, waitlist→booking, donor→membro, renewal→pago | `marketing_events` fonte (booking_created, member_profile) já cruza — falta view |
| Referral | adesões com código/trimestre (hoje: 0) | `referral_reward_inviter` disparos |
| Receita | € atribuído a email (UTM) por mês: loja, doações, quotas | GA4/relatório manual mensal |

**Instrumentação:** (1) webhook Resend (R1); (2) UTM (R1); (3) view SQL simples `marketing_funnel_conversions` (enrollment completed com goal_reached vs total) — leitura, sem escrita no fluxo.

**Ritual do operador:** semanal 10 min — dashboard admin (falhas, fila, unsubscribes); mensal 30 min — 1 página: enviados, opens/CTR por template, conversões por funil, top artigos clicados → decide a edição seguinte. Regra: **um template só se mexe depois de 2 ciclos de dados.**

---

## 10. Registo de guardrails & riscos

| Risco | Onde mora | Mitigação proposta |
|---|---|---|
| Deliverability (complaints invisíveis) | F1/F2 — massa sem feedback loop | R1 antes de R2; suppression automática por bounce/complaint |
| Over-mailing | scripts fora de caps (F3) | R6: 1 campanha comercial/mês, lotes ≤300/dia, registo obrigatório |
| Consent | lista newsletter é explícita ✓; 196 `assumed` do site | campanhas comerciais só a `explicit` OU a `assumed` com relação ativa; `@sem-email.local` já bloqueado no motor ✓ |
| Renewal a pendente/revogado | F4 | segmento por código já exclui ✓; bloquear ativação até copy nova (R4) |
| Tom (hype-creep) | flash sales repetidas | máx. 2 flash/ano, sempre ancoradas em datas marianas reais; nunca como 1º toque de um novo segmento |
| ES sem copy | 19 subs | mantêm-se fora ✓ ([marketing-core.ts:293-300](../src/lib/marketing-core.ts)); plano futuro: rever ES machine-translated antes de qualquer envio — **future work** |
| Testemunhos | risco de inventar | regra: todo o testemunho citado em email tem slug de `posts` na linha do template; senão PLACEHOLDER |
| Payment flow | fora do âmbito | nenhuma recomendação toca handlers/valores/webhook/waterfall ✓ (R3-R5 são só funis/copy) |

---

## 11. Roadmap

### Agora (esta semana) — fundações, nada envia sem aprovação
1. **R1** webhook Resend + UTM — `src/app/api/webhooks/resend/route.ts` (novo), `email-renderer.ts` (`marketingUrl`), env `RESEND_WEBHOOK_SECRET`.
2. **R7** fix segmentação brochura — `marketing-data.ts:235,253` + teste em `src/tests/marketing-core.test.ts`.
3. **R4** reescrever `membership_renewal` (PT+EN) — `email-renderer.ts:2583-2601` + bloco EN. Funil continua draft.
4. **R10** post "sócio" — CMS (editar título/corpo ou redirect).

### A seguir (este mês) — o "dar"
5. **R2** newsletter nº 1: template `newsletter_monthly` (catálogo + EN), proposta de artigos (§8) → **aprovação Gabriel** → lotes 3×~292 (PT dias 1-2, EN dia 3), registo em `marketing_campaigns`. Env temporária `MARKETING_CRON_DAILY_SEND_CAP=300`, repor depois.
6. **R3** funil donor-nurture — nova linha em `marketing_funnels` (3 passos), rever PT-BR dos 3 templates primeiro (R8 parcial).
7. **R8** varrimento PT-BR dos templates restantes — `email-renderer.ts` (só strings).
8. **R6** política de campanhas — escrever no `MARKETING_SYSTEM.md` §2.

### Depois (trimestre)
9. **R5** referral v2 (1 email/ano, gancho de oração) — depois de 2 meses de dados do R1.
10. Campanha pontual lead→membro (templates `lead_to_member_*`) a lista curta aprovada à mão.
11. Emails de datas marianas (§7) — 3-4/ano dentro da newsletter ou como edição especial.
12. Verificar `waitlist_open_spot` com `?dryRun=1` no próximo ciclo de vagas (F11).
13. Plano ES (future work): rever traduções `mt_unreviewed`, depois decidir newsletter ES.
14. **R9** quiet hours no cron.

**Regra transversal:** nada do que envia a pessoas reais ativa sem aprovação explícita do Gabriel, e todo o envio em massa é em lotes dentro dos limites declarados acima.

---

*Auditoria produzida por leitura direta de: `marketing-automation-engine.ts`, `marketing-core.ts`, `marketing-data.ts`, `marketing-email.ts`, `marketing-limits.ts`, `email-renderer.ts` (catálogo completo), `api/cron/marketing-automations/route.ts`, `scripts/railway-cron.mjs`, `admin/marketing/*`, `payment-handlers.ts` (só leitura, referral), docs existentes, e queries read-only a `marketing_*`, `posts`, `wp_pages` em produção a 2026-07-09. Nenhuma escrita foi feita na BD ou no código de envio.*
