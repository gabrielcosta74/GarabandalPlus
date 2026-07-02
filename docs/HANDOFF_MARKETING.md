# HANDOFF — Sistema de Emails & Funis de Marketing (Apostolado de Garabandal)

> Documento de passagem de tarefa para outra IA continuar o trabalho.
> Lê tudo antes de mexer em código. **Plano completo:** `docs/MARKETING_FUNNEL_STRATEGY.md`.

---

## 0. O TEU PAPEL
Vais continuar a melhorar o sistema de emails de marketing deste projeto (Next.js 15 + Supabase).
O objetivo de negócio: repescar leads, organizar a lista de contactos, fazer cross-sell (livros da
loja, doações, adesão a membro), crescer a comunidade (convites/referral) — aumentando vendas e
conversões **sem spammar**. O trabalho está planeado por fases; a **Fase 0** é a próxima a executar.

---

## 1. CONTEXTO DO PROJETO (factos que tens de saber)
- App Next.js 15 (App Router), TypeScript. BD = **Supabase de PRODUÇÃO** (dev corre contra a BD
  live). Cuidado com migrações; protege colunas opcionais em código.
- Domínio: o site usa o **apex** `apostoladodegarabandal.com`. Houve migração de
  `app.apostoladodegarabandal.com` → apex. **Os emails NÃO podem usar o subdomínio `app.`**.
- URL base dos emails vem de `getAppUrl()` / `APP_URL` em `src/lib/config.ts` (default em prod = apex).
  ⚠️ **Verificar nas env de produção** que `APP_URL` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`
  apontam para o apex e não para `app.` (o README refere `CRON_TARGET_URL=https://app...`, sinal de
  que o subdomínio pode ainda estar configurado).
- **Vocabulário PT público:** usar "membro/membros", **nunca** "sócio/sócios".
- **Loja:** vende **livros** sobre Garabandal (não terços/estátuas/medalhas).
- **Segurança de pagamentos:** pedidos de UI/redesign **não** podem tocar handlers, cálculo de
  valores, endpoints, webhook ou waterfall de pagamento — só JSX/CSS/layout.
- Emails saem de `no-reply@apostoladodegarabandal.com` (Resend). Por isso **não** dizer "responda a
  este email" — direcionar para WhatsApp (`wa.me/351915206815`) ou `geral@apostoladodegarabandal.com`.

---

## 2. O QUE JÁ FOI FEITO NESTA SESSÃO (não repetir)
1. **`src/lib/email-renderer.ts`** — adicionado botão verde "Falar connosco no WhatsApp" no rodapé
   partilhado (função `Layout`) de **todos** os emails; e substituídas **25 ocorrências** de
   "responda a este email" / "reply to this email" (PT+EN) por contacto via WhatsApp + `geral@…`.
   Constantes auxiliares (`contactWa`, `contactMail`, `WhatsAppButton`) ficam logo após o bloco `FONTS`.
   Typecheck OK.
2. **`docs/MARKETING_FUNNEL_STRATEGY.md`** — plano estratégico completo (diagnóstico, lacunas,
   estratégia "escada do ciclo de vida", matriz de cross-sell, fases 0–5, design, anti-spam).
3. **Design de email escolhido pelo cliente:** o estilo de `emails/_preview-login-access.html`
   (hero com Nossa Senhora de Garabandal + overlay, badge dourado `#d4af37`, card branco arredondado
   sobre `#eef2f8`, fonte Helvetica Neue, CTA dourado). Ver doc secção 4b.
4. **Requisito de modo escuro:** o email deve ficar **sempre claro** mesmo em dark mode (no iOS o
   fundo aparecia escuro). Técnica validada em protótipo: metas `color-scheme: light only`,
   `@media (prefers-color-scheme: dark)` com `!important`, seletores Outlook `[data-ogsc]/[data-ogsb]`,
   e `bgcolor` explícito. (Caveat: app Gmail Android não é 100% controlável, mas fica legível.)

> Os protótipos visuais foram gerados num scratchpad efémero (não estão no repo). A **fonte de
> verdade do design** é `emails/_preview-login-access.html` + a secção 4b do plano.

---

## 3. COMO O SISTEMA FUNCIONA (mapa de ficheiros)
- `src/lib/marketing-data.ts` → `buildMarketingContacts()` unifica 10 tabelas numa lista de contactos
  (membros, booking_leads, pilgrimage_waitlists, bookings, pilgrims, pilgrimage_payments, donations,
  **store_orders**, pagamentos_quotas, marketing_suppression_list).
- `src/lib/marketing-core.ts` → segmentos (`evaluateMarketingSegments`, ~L230), score
  (`calculateMarketingScore`, ~L251), lifecycle, recomendação.
- `src/lib/marketing-automation-engine.ts` → `processMarketingEnrollment` (~L180),
  `marketingStepConditionPasses` (~L26), `prepareMarketingFunnelEnrollments`.
- `src/lib/marketing-limits.ts` → governador anti-spam: **1 email/dia por contacto, 24h mínimo,
  50/dia global, lote 15** (global por contacto → estar em vários funis NÃO gera spam).
- `src/app/api/cron/marketing-automations/route.ts` → cron que inscreve e envia; ordena por
  `next_run_at` (FIFO, ~L92).
- `src/lib/email-renderer.ts` → `Layout` (~L200), catálogo `MARKETING_EMAIL_TEMPLATES` (~L1383),
  `renderMarketingTemplateEmail` (~L2137). Funis vivem na tabela `marketing_funnels` (campos
  `segment_slug`, `steps[]`, `status`).

**Lacunas-chave já diagnosticadas:** (1) zero cross-sell de loja; (2) lista de espera tratada como
"hot lead" e empurrada a inscrever-se sem haver vagas; (3) `waitlist_open_spot` existe mas nunca
dispara; (4) sequenciamento FIFO sem prioridade; (5) falta conteúdo de valor (só pedidos); (6) sem
captura de topo de funil nem winback.

---

## 4. PRÓXIMA TAREFA — FASE 0 (executar isto a seguir)
Aprovado pelo cliente: começar pela Fase 0. Entregar com revisão entre passos.

### 4.1 Aplicar o novo design (template-mestre)
Converter a função `Layout` em `src/lib/email-renderer.ts` para o estilo de
`emails/_preview-login-access.html`, **mantendo as APIs** (`Header`, `Section`, `Button`,
`renderMarketingTemplateEmail`) para que todos os templates herdem o visual.
Incluir:
- hero com `${APP_URL}/images/nossasenhoragarabandal.jpg` + overlay + badge dourado (categoria) + headline;
- CTA dourado `#d4af37`; bloco WhatsApp verde + `geral@…`; rodapé com cancelar subscrição;
- **bloqueio de dark-mode** (metas + `@media (prefers-color-scheme: dark)` + `[data-ogsc]/[data-ogsb]`
  + `bgcolor` explícito no body/wrapper/card), conforme doc secção 4b;
- suporte opcional a "cartão de produto" (capa+título+preço+link) para emails de loja.
Verificar: render de um template e confirmar que não há `app.` no HTML, que o botão WhatsApp aparece,
e que os fundos têm `bgcolor`. Correr `npx tsc --noEmit`.

### 4.2 Corrigir contradição da lista de espera
Em `src/lib/marketing-core.ts` (~L233): remover `s.waitlists > 0` da condição de
`hot-pilgrimage-leads` (manter lista de espera só em `waitlist-contacts`). Garantir que a copy de
recuperação ("garanta a sua vaga") não é enviada a quem está em lista de espera.

### 4.3 Gate de disponibilidade
Em `src/lib/marketing-automation-engine.ts` `marketingStepConditionPasses` (~L26): adicionar
condição `has_availability` para os passos de recuperação só dispararem quando a peregrinação tem
vagas reais (precisa de saber as vagas — ver tabela `pilgrimages`/`bookings`).

### 4.4 Disparar `waitlist_open_spot` a sério
Criar o gatilho que envia o template `waitlist_open_spot` quando abre vaga numa peregrinação
(opções: cron que compara lista de espera vs vagas, ou hook ao cancelar/abrir reserva). Confirmar
com o cliente qual a abordagem antes de implementar.

### 4.5 Prioridade no motor (opcional dentro da fase)
No cron (`route.ts` ~L92), ordenar enrollments devidos por valor/score do contacto, não só por
`next_run_at`, para enviar primeiro o email mais relevante quando há sobreposição de funis.

---

## 5. FASES SEGUINTES (resumo — detalhe no plano)
- **Fase 1** — captura/organização: signup newsletter + welcome flow; novos segmentos
  (store-buyers-not-members, donors-not-buyers, pilgrims-not-members, inactive-180d, newsletter-only).
- **Fase 2** — cross-sell/vendas: funis e templates de **Loja** (`category: 'Loja'`); doação por
  impacto; escada para membro com benefícios (bónus 5€ já existe); winback de inativos.
- **Fase 3** — comunidade: convidar-amigo alargado a todos (não só membros); referral; campanhas
  sazonais/litúrgicas (N. Sra. do Carmo 16 jul, Advento, Quaresma, aniversário de adesão).
- **Fase 4** — conteúdo & cadência: newsletter de valor intercalada com pedidos; respeitar 1/dia;
  opt-out por tema; A/B de assuntos.
- **Fase 5** — medição: conversão por funil (coluna `metrics`), receita atribuída, taxa de opt-out.

---

## 6. GUARDRAILS (regras a respeitar sempre)
- Não tocar em handlers/cálculos/endpoints/webhook de **pagamento**.
- PT público: "membro", nunca "sócio".
- Emails: nunca `app.` no URL; nunca "responda a este email"; sempre WhatsApp/`geral@`.
- Anti-spam: o cap global (1/dia) é a proteção principal — **não baixar volume, subir relevância**;
  nunca 2 pedidos seguidos sem conteúdo de valor pelo meio.
- BD é produção: cautela com migrações; degradar com elegância se uma coluna faltar.
- Verificar a env de produção do URL base (ver §1) antes de assumir que os links estão certos.
- Validar sempre com `npx tsc --noEmit` e, quando útil, renderizar um template para inspeção.

---

## 7. PRIMEIRO PASSO RECOMENDADO PARA A NOVA IA
1. Ler `docs/MARKETING_FUNNEL_STRATEGY.md` (plano completo) e `emails/_preview-login-access.html` (design).
2. Confirmar com o utilizador a abordagem do gatilho da §4.4.
3. Implementar a §4.1 (template-mestre + dark-mode) e mostrar um render para aprovação antes de seguir.
