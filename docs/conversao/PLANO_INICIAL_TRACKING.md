# Plano de tracking de conversão: Peregrinação Mariana 2027

Página: `/peregrinacoes/peregrinacao-mariana-2027` → `/peregrinacoes/peregrinacao-mariana-2027/inscrever`
Data da análise: 2026-11-02

## 1. O que existe hoje

| Camada | Estado |
|---|---|
| PostHog (cliente) | `src/lib/analytics.ts`: pageview manual, autocapture de cliques, heatmaps, dead clicks, gravação de sessões. **Só arranca depois de "Aceitar todos"** no banner de cookies. |
| Página de detalhe (`src/app/peregrinacoes/[slug]/page.tsx`) | **Zero eventos próprios.** Só o chat (`chat_opened`, `chat_message_sent`, `chat_cta_clicked`) e a brochura (`brochure_requested`) emitem eventos. |
| Formulário de inscrição (`.../inscrever/page.tsx`, 4–5 passos) | **Zero eventos de passo.** Só `/api/leads/capture` no passo 1 (grava em `booking_leads`). |
| Servidor | `booking_created` em `/api/booking/create`, mas só quando o utilizador deu consentimento. **Não existe evento de pagamento confirmado.** |
| Atribuição | Os emails de marketing já levam UTM, mas a tabela `bookings` **não tem coluna de origem** (utm/referrer/landing). |

A loja e os donativos já têm um funil completo (`store_checkout_*`, `donation_*`): o padrão existe, só não foi aplicado às peregrinações.

## 2. Dados reais (Supabase, 2026-11-02)

- **28 inscrições**, todas desde 13/10 (8 no dia do lançamento, depois cerca de 1 por dia).
- **20 confirmadas e pagas · 8 pendentes sem pagamento** (29% das inscrições ainda não pagaram).
- **51 leads abandonados** em `booking_leads` (48 `draft` + 3 `notified`), mais 6 `interested`.
  → Cerca de 79 pessoas deram o email no passo 1 e só 28 concluíram: **~35% de conclusão do formulário**.
- **`step_reached` está sempre a 1**: o lead nunca é atualizado depois do passo 1. Por isso não sabemos se as pessoas desistem nos dados pessoais, nos voos ou no pagamento. É o buraco mais caro.

### Porque é que o PostHog mostra menos visitas do que as reais

O PostHog não está avariado. Está a contar só um subconjunto, por causa de filtros em `src/lib/analytics.ts`:
1. **Consentimento:** só conta quem clica em "Aceitar todos" (ou ativa Analíticos). Quem rejeita, ignora o banner ou sai antes de responder não conta. Normalmente isto é a maioria.
2. **Do Not Track:** `hasDoNotTrack()` exclui quem tem DNT ligado (Brave, alguns Firefox e extensões de privacidade).
3. **Bloqueadores:** o proxy `/maria-sinais` ajuda, mas alguns bloqueadores apanham o script na mesma.
4. **Eventos de servidor também dependem de consentimento:** `booking_created` só é enviado se a pessoa aceitou. Por isso o PostHog mostra menos inscrições do que as 28 reais e a "taxa de conversão" fica sem sentido (numerador e denominador enviesados de forma diferente).

Conclusão: usar o PostHog para **comportamento** (o que fazem, onde clicam, onde desistem) e a **base de dados** para **números absolutos** (leads, inscrições, pagamentos). Para o total real de visitas, comparar com o Cloudflare (Analytics → tráfego por caminho), que conta tudo do lado do servidor. A Fase 3 (cookieless) fecha a maior parte deste buraco dentro do PostHog.

## 3. Problemas por ordem de impacto

1. **Visibilidade parcial.** O PostHog só vê quem aceita cookies. Não sabemos sequer a taxa de aceitação, por isso qualquer número de visitas ou taxa de conversão no PostHog está enviesado e subestimado. Ao confirmar em produção: sem aceitar, sai zero pedidos para `/maria-sinais`.
2. **Sem funil no formulário.** Não se sabe em que passo nem em que campo as pessoas desistem.
3. **Sem atribuição na inscrição.** Não se consegue responder a "o email X ou o Facebook trouxe quantas inscrições pagas?".
4. **Sem evento de pagamento.** O funil acaba em "inscrição criada", mas o dinheiro só entra no pagamento (e 8 em 28 estão parados aí).
5. **A página não diz o que é lido.** Não sabemos quem chega ao preço, ao roteiro ou à equipa, nem que CTA é clicado (hero, barra fixa, bloco de preço, resumo mobile).
6. **UX que afeta os dados:** no telemóvel o banner de cookies tapa o CTA e o chat logo à entrada.

## 4. Plano

### Fase 1: medição base, sem depender de cookies (1–2 dias)

**1.1 Funil em base de dados, sem consentimento** (dados operacionais, não analíticos):
- Atualizar `booking_leads.step_reached` a cada avanço de passo (2 = dados pessoais, 3 = revisão, 4 = voos, 5 = pagamento) e guardar em `data` o último sub-passo (`detailsSection`/`paymentSection`). Reaproveita a chamada a `/api/leads/capture` que já existe.
- Ao criar a inscrição, ligar o lead à inscrição (`status = 'converted'`, `booking_id`).
- Assim temos um funil real e completo para **100% das pessoas que deram o email**, independentemente dos cookies.

**1.2 Atribuição gravada na inscrição:**
- Migração: `bookings.attribution jsonb` (e o mesmo em `booking_leads.data`): `utm_source/medium/campaign/content`, `referrer_host`, `landing_path`, `first_seen_at`.
- No cliente, guardar o *first touch* em `sessionStorage` quando a sessão chega com UTM e enviá-lo em `/api/leads/capture` e `/api/booking/create`.
- São só parâmetros de campanha e o domínio de origem, sem identificadores. Nota: confirmar com quem trata do RGPD se isto pode ficar fora do consentimento analítico. Em caso de dúvida, guardar só quando há consentimento.

**1.3 Evento de pagamento no servidor:**
- `booking_paid` (e `booking_payment_failed`) no webhook/confirmação Reduniq e no registo manual de pagamento, com `amount`, `is_deposit`, `days_since_booking`, `payment_method` e o `distinct_id` guardado na inscrição (só se havia consentimento).

### Fase 2: eventos na página e no formulário (2 dias)

Seguir o padrão de `captureStoreEvent`: criar `capturePilgrimageEvent(event, props)` em `src/lib/analytics.ts` que junte sempre `pilgrimage_id`, `pilgrimage_slug`, `locale`, `device` e o `utm_campaign` da sessão.

**Página de detalhe:**
| Evento | Quando | Propriedades |
|---|---|---|
| `pilgrimage_viewed` | pilgrimage carregado | `is_early_access`, `scarcity_pct`, `price`, `logged_in`, `is_member` |
| `pilgrimage_section_viewed` | IntersectionObserver 50% em `#overview`, `#team`, `#itinerary`, `#pricing`, `#trip-details` | `section`, `seconds_since_load` |
| `pilgrimage_nav_clicked` | links do menu de secções | `target` |
| `pilgrimage_cta_clicked` | cada CTA de inscrição | `placement`: `pricing` / `sticky_bar` / `essentials_mobile` / `early_access_modal` / `chat` |
| `pilgrimage_info_opened` | `PilgrimageInfoModal` | `mode`: `included` / `flights` |
| `pilgrimage_payment_warning_shown` | `PilgrimagePaymentWarningModal` | `action`: continuar / fechar |
| `pilgrimage_waitlist_opened` / `_submitted` | `WaitlistModal` | — |
| `early_access_gate_*` | gate e banner de pré-lançamento | `outcome` |

**Formulário (`inscrever`):**
| Evento | Quando | Propriedades |
|---|---|---|
| `registration_started` | montagem | `entry_placement` (via `?from=` no link do CTA) |
| `registration_step_viewed` | cada mudança de `step` / sub-secção | `step`, `step_name`, `sub_section`, `pilgrim_index` |
| `registration_step_completed` | `nextStep()` com sucesso | `step`, `seconds_on_step` |
| `registration_validation_failed` | `onError` | `step`, `fields` (só nomes dos campos, nunca valores) |
| `registration_back_clicked` | botões Voltar | `from_step` |
| `registration_duplicate_detected` / `registration_login_required` | passo 1 | — |
| `registration_pilgrim_added` | `append()` | `pilgrim_count` |
| `registration_flight_choice` | passo de voos | `option` |
| `registration_payment_plan_selected` | escolha prestações / método | `installments`, `payment_method` |
| `registration_submitted` / `registration_submit_failed` | `onSubmit` | `error_code` |

Notas:
- `/peregrinacoes/inscricao/[id]` (página da inscrição com pagamento) é pública no analytics. Confirmar que não aparecem dados pessoais nas gravações, ou adicioná-la a `SENSITIVE_INTERACTION_PREFIXES`.
- Os campos do formulário já ficam mascarados (`maskAllInputs`). Manter.

### Fase 3: cobertura sem cookies no PostHog (meio dia + validação legal)

- Ativar `cookieless_mode: 'on_reject'` no `posthog.init` (e o modo cookieless no projeto PostHog): quem rejeita passa a contar em pageviews e eventos agregados, sem cookies nem gravação, com hash diário do lado do servidor. Assim a taxa de conversão passa a ter um denominador real.
- Medir a taxa de consentimento (evento sem identificador `consent_choice`: aceitar / rejeitar / configurar).
- Antes de ligar: confirmar a versão de `posthog-js` instalada e validar com quem trata do RGPD (a medição de audiência cookieless costuma estar isenta de consentimento, mas a decisão é vossa).
- UX: no telemóvel, encolher o banner ou empurrá-lo para cima para não tapar o CTA principal nem o chat.

### Fase 4: análise (contínuo)

**Dashboard PostHog "Peregrinação 2027":**
1. Funil: `pilgrimage_viewed` → `pilgrimage_section_viewed(pricing)` → `pilgrimage_cta_clicked` → `registration_step_viewed(1..5)` → `booking_created` → `booking_paid`, com *breakdown* por `utm_source`, dispositivo e idioma.
2. Que CTA converte (por `placement`).
3. Profundidade de leitura vs. conversão: quem vê o roteiro inscreve-se mais?
4. Campos que mais falham na validação.
5. Tempo entre inscrição e pagamento; pendentes há mais de 7 dias.
6. Gravações filtradas: "chegou ao passo de pagamento e saiu" e "clicou no CTA e não começou".

**Painel interno (admin, sem cookies)** com `booking_leads` + `bookings`: funil por passo, origem e semana, e lista de leads abandonados por passo. É a fonte de verdade para números absolutos.

**Ações que este tracking desbloqueia:**
- Recuperação de abandono **por passo** (hoje `notified` só cobre 3 leads): email diferente para quem parou nos voos e para quem parou no pagamento.
- Lembrete automático para as 8 inscrições pendentes sem pagamento.
- Perguntas frequentes do chat → FAQ/objeções na página.

**Sobre testes A/B:** com ~1 inscrição por dia não há volume para significância estatística em semanas. Usar primeiro gravações, abandono por passo e perguntas do chat (qualitativo). Feature flags só para mudanças grandes (ex.: preço/prestações em destaque vs. roteiro primeiro).

## 5. Ordem recomendada

1. **1.1 + 1.3** (funil em BD + pagamento): dá números reais já esta semana, sem tocar em consentimento.
2. **1.2** atribuição.
3. **Fase 2** eventos (página + formulário).
4. **Fase 3** cookieless, depois da validação legal.
5. Dashboards e painel admin.

Restrição: não mexer em handlers de pagamento, cálculo de montantes, endpoints nem webhook além de **acrescentar** chamadas de tracking em try/catch que nunca bloqueiem o fluxo.
