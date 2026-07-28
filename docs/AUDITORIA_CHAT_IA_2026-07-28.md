# Auditoria do Chat de Apoio IA — 28/07/2026

> **Estado (28/07/2026):** P0 e P1 implementados e verificados contra o modelo real.
>
> Decisões do operador que alteram o plano original:
> - O assistente **pode** dizer o número exato de vagas quando restarem **menos de 5**;
>   a partir de 5 usa só "Lugares limitados".
> - **Não existe roteiro em PDF.** A rota `/api/pilgrimages/[slug]/pdf` devolve **500** e não é
>   referida em nenhum ponto do UI — a IA andava a enviar pessoas para um link morto (ver conversa
>   real `cd421032`, 27/07). O token `[[PDF]]` foi removido e o assistente passa a contar o
>   itinerário dia-a-dia a partir do contexto. **Se o PDF vier a ser reparado, reverter isto.**
> - As perguntas de qualificação **mantêm-se também dentro do formulário** (são ferramenta de
>   conversão), mas têm de vir depois de indicar o próximo passo concreto — e são suprimidas
>   quando a pessoa mostra confusão ou cansaço.
>
> Por fazer: P2 (alertas ao admin, colunas de estado, painel, métricas) e P3 itens 20-21.

Base: **102 conversas reais** em `chat_conversations` (21/04/2026 → 28/07/2026), o prompt em
`src/app/api/chat/route.ts`, a KB em `src/lib/chat-kb/*.md` e o widget em
`src/components/pilgrimage/ChatWidget.tsx`.

## Números de partida

| Métrica | Valor | Leitura |
|---|---|---|
| Conversas totais | 102 | 48 nos últimos 30 dias |
| Conversas com **1 só mensagem** do utilizador | **69 (68%)** | pessoa pergunta uma coisa e desaparece |
| Conversas com ≥2 mensagens | 33 (32%) | só aqui é que o lead-capture chega a aparecer |
| Conversas com **escalada** ("Essa informação específica não tenho") | **38 (37%)** | grande parte são **falsas** escaladas |
| Conversas onde saiu o token `[[QUERO_IR]]` | 5 (5%) | o único botão de ação que existe hoje |
| Pessoas que escreveram telefone/email no chat | 2 | ninguém as recolheu |
| Leads atribuídos ao chat em `booking_leads` | 0 identificáveis | o funil não fecha |

Distribuição por peregrinação: Ibérico Nov/2026 (69), Itália+Medjugorje Abr/2027 (20),
Mariano Out/2026 (8), restantes (5).

---

## Parte 1 — Confusão entre a IA e o processo de inscrição

Confirma-se o que suspeitavas. Não é impressão: está nas transcrições.

### 1.1 Pessoa a meio do formulário pensa que finaliza a inscrição pelo chat
**Conversa `67c55d42` — 28/07, Itália+Medjugorje, contexto `registration-form`**

> — "Puxa vida nunca acaba esta inscrição"
> — "Acho que fiz tudo correto né?"
> — "Já acabou? Quero finalizar"
> — "Onde finaliza?"
> — "Nao" (à pergunta se já tinha chegado ao pagamento)

A IA respondeu:
> "…siga até a última etapa do formulário, onde **normalmente** há um botão para confirmar a inscrição."
> "Você está na parte de **'Organização de quartos'** ou **'Método de doação'**?"

Dois problemas graves:
1. **"normalmente"** — a IA está a adivinhar. Não sabe os passos reais.
2. **Os nomes dos passos estão errados.** Os passos reais em
   [inscrever/page.tsx:1314-1317](src/app/peregrinacoes/[slug]/inscrever/page.tsx#L1314-L1317) são
   `Identificação → Dados das pessoas → Alojamento → Voos → Doação`, e o botão final chama-se
   **"Confirmar Inscrição"** ([linha 1637](src/app/peregrinacoes/[slug]/inscrever/page.tsx#L1637)).
   A KB (`01-inscricao.md`) tem nomes antigos ("Organização de quartos", "Método de doação").

Esta pessoa muito provavelmente **saiu sem finalizar**. É a conversa mais recente da base.

### 1.2 A IA não sabe em que passo a pessoa está
O `ChatWidget` no formulário é montado **sem qualquer estado**:
```tsx
<ChatWidget pilgrimageSlug={slug} pilgrimageTitle={pilgrimage?.title} context="registration-form" />
```
([inscrever/page.tsx:1648](src/app/peregrinacoes/[slug]/inscrever/page.tsx#L1648))

Sem `registrationLink`, sem `pilgrimageId`, sem `step`. Consequências:
- o cartão de CTA no topo do chat **nunca aparece** no formulário (depende de `registrationLink`);
- as capturas de interesse feitas dentro do formulário perdem a atribuição à peregrinação;
- a IA tem de perguntar "em que passo está?" em vez de saber.

### 1.3 Pessoas a tratar a IA como se fosse a equipa
- **`9ecbceb7`** — Maria dos Anjos: *"**Andreia** tenho muita dificuldade com isto. Se for possível
  falar pelo whatsapp agradecia"* — chamou a IA pelo nome de uma pessoa da equipa. A resposta deu o
  número **em texto**, sem botão clicável (o marcador de escalada não foi emitido, logo o widget não
  renderizou o CTA de WhatsApp).
- **`b920d14c`** — Wander Maia **colou uma conversa de WhatsApp inteira** no chat
  (`[30/5 09:16] Wander Maia: Bom dia…`), a pedir bilhetes aéreos. Achava que falava com uma pessoa.
- **`091d393c`** — Bernardete: *"tenho interesse… tem essas duas vagas? 54991122785…
  bernamdpsicologa@gmail.com"* — deu nome, telefone e email. A IA respondeu "clique em Iniciar
  Inscrição" e o contacto **ficou enterrado no `chat_conversations`**, que ninguém lê.
- **`4be635a1`** — Marco Antônio: *"qualquer eventual vaga a mais, por favor, avisem pelo whatsApp
  (11) 991879552"*. A IA respondeu *"recomendo que clique em **'Estou mesmo interessado em ir'**"* —
  **mas não emitiu o token `[[QUERO_IR]]` nessa resposta**, portanto esse botão nunca apareceu no
  ecrã. Mandou a pessoa clicar num botão inexistente.

### 1.4 "Já fiz a inscrição" tratado como fim de conversa
**`1ec77bec`** — pessoa diz "Já fiz a inscrição". A IA responde *"Que ótimo! 🙌 …Você já começou a
pensar em como será a sua experiência em Medjugorje?"*

Não avisou do passo que determina se a vaga existe: **a 1ª doação tem de ser paga em 5 dias úteis,
senão a vaga não fica confirmada** (`02-pagamentos.md`). Inscrição sem pagamento = vaga perdida.

### 1.5 Quem já está inscrito não encontra onde pagar
- **`6b68a21a`** — Elsa Rocha Santos: *"não estou a encontrar na página lugar para o pagamento da
  prestação"*. A IA descreveu o caminho **em texto** ("Acesse a sua conta → minhas inscrições") sem
  **um único link** para `/peregrinacoes/minhas-inscricoes`.
- **`cd421032`** — *"Já fiz a inscrição para mim e minha irmã. Como faço para pagar?"* — mesma
  resposta em texto, mesma ausência de link.

---

## Parte 2 — Respostas erradas ou arriscadas

### 2.1 Falsas escaladas (37% das conversas) — o problema nº1 de qualidade
"**Que documentos preciso?**" dispara *"Essa informação específica não tenho"* em pelo menos 7
conversas (`c415e8d5`, `8f53946c`, `2e16cea9`, `f0ac7093`, `4be635a1`, `b5c410ef`, `36fbf010`) —
**apesar de a resposta estar em `04-documentos.md`** e de o prompt dizer explicitamente
*"Não uses marcador de escalada para a pergunta genérica 'que documentos preciso?'"*
([route.ts:297](src/app/api/chat/route.ts#L297)).

O efeito é duplo e mau: a IA parece incompetente e o widget mostra o botão de WhatsApp, enviando
para atendimento humano gente que já tinha a resposta no ecrã seguinte.

**Causa:** o prompt tem ~160 linhas antes do contexto. A regra absoluta nº2 ("se não está no
contexto, começa SEMPRE com esta frase") está numa secção chamada **REGRAS ABSOLUTAS -- OBRIGATÓRIAS**,
e as exceções estão 30 linhas acima, em prosa. O `gpt-4o-mini` segue a regra mais enfática.

### 2.2 O idioma da página vence sempre a língua da pessoa — bug confirmado
```ts
if (requestedLocale === 'en') return 'en';
if (requestedLocale === 'pt') return 'pt';   // ← corta aqui, sempre
```
([route.ts:66-67](src/app/api/chat/route.ts#L66-L67))

O widget envia **sempre** `locale`, logo toda a deteção por texto das linhas 69-83 é **código morto**.

Resultado real — **`fd124bd0`**: pessoa escreve *"Hello, do you know how many are on the waiting list
and what the price is?"* e recebe **em português**: *"Essa informação específica não tenho…"*. Só
depois de escrever *"yes, in English please"* é que mudou — e ainda assim mandou clicar no botão
**"Iniciar Inscrição"** (em português) numa resposta em inglês.

### 2.3 A IA está a dar números exatos de vagas
**`4be635a1`**: *"só resta **uma vaga**. …não seria possível inscrever um casal neste momento."*

Isto contradiz a política de escassez em vigor (nunca expor contagens exatas) e, pior, **desqualificou
ativamente um casal interessado**. A causa é o contexto: `fetchPilgrimageContext` faz
`select('*')` e passa `current_vacancies` / `effective_vacancies` ao modelo
([route.ts:143-153](src/app/api/chat/route.ts#L143-L153)).

### 2.4 Conselhos inventados sobre o formulário
**`9ecbceb7`** — pessoa escolhe quarto duplo mas não tem com quem partilhar:
> "apenas certifique-se de **deixar os campos necessários para a outra pessoa em branco** …
> se surgir alguém que queira dividir, **você pode sempre ajustar isso mais tarde**"

Duas afirmações sobre o comportamento do formulário e sobre alterações posteriores que **não estão em
lado nenhum da KB**. Se o formulário validar esses campos, a pessoa fica bloqueada.

Na mesma conversa, a *"Dava-me jeito pagar a inscrição só em 20 de Agosto"* a IA respondeu
*"pode considerar entrar na **lista de espera**"* — resposta sem sentido para quem está a meio da
inscrição numa peregrinação com vagas.

### 2.5 Não faz contas
**`a458b445`** — casal com 3 filhos (3, 5 e 13 anos). A IA acertou os descontos e, à pergunta
seguinte *"Qual seria o valor para todos nós?"*, escalou. Uma família de 5 pessoas — o maior lead do
período — foi despachada para o WhatsApp.

### 2.6 Câmbio EUR→BRL: comportamento inconsistente
- **`691797c8`** *"Em reais qual fica o valor?"* → escalada.
- **`cd421032`** *"Como faço a cotação?"* → escalada **mas** com o link do PDF em BRL.

A app tem `/api/pilgrimages/[slug]/pdf?currency=BRL`, `PaymentCurrencyDisplay` e `ExchangeRateChart`.
A IA quase nunca os usa. ~60% do público é brasileiro; esta pergunta vai repetir-se sempre.

### 2.7 Contacto da agência do Brasil
**`c7c1b723`** (Denise) e **`6765da43`** perguntaram o nome/telefone da agência antes de decidir.
Escalada nas duas. A KB **hoje já tem** *Bella Sul — Ângela — +55 41 9633-2390* em `05-logistica.md`,
mas o padrão de escalada (§2.1) continua a poder engoli-la.

### 2.8 Erro real do formulário reportado duas vezes, sem seguimento
**`bbfc321b`** e **`aa3ab0f8`** (27/07, duas pessoas diferentes, mesmo dia):
*"Não deixa preencher o mail"* / *"Não me deixa preencher o mail"*.

A IA deu conselhos genéricos ("verifique espaços extras, atualize a página, mude de navegador").
**Isto cheira a bug real no passo de Identificação da Itália+Medjugorje** — vale a pena reproduzir. E
nenhum alerta chegou à equipa.

---

## Parte 3 — Encaminhamento para inscrição: o que falta

Hoje o chat só tem **três** caminhos clicáveis:

| Elemento | Quando aparece | Limitação |
|---|---|---|
| Cartão CTA no topo | só se `registrationLink` for passado | **ausente no formulário de inscrição** |
| Botões WhatsApp/Email | só com o marcador de escalada | aparece justamente quando a IA falha |
| Botão `[[QUERO_IR]]` | só em lista de espera + token emitido | 5 de 102 conversas |

**Não existe nenhum botão de inscrição dentro das mensagens.** Quando a IA escreve *"clique no botão
amarelo Iniciar Inscrição"*, em telemóvel o chat ocupa o ecrã todo — a pessoa tem de fechar o chat,
procurar o botão e perder o fio da conversa. Isto acontece nas ~26 conversas de intenção alta
("Como me inscrevo?", "Quanto custa?", "Posso pagar em prestações?").

E o `lead capture` inline só aparece **a partir da 2ª mensagem** do utilizador
([ChatWidget.tsx:299](src/components/pilgrimage/ChatWidget.tsx#L299)) — ou seja, **nunca** em 68% das
conversas.

---

# Plano de melhorias

## P0 — Correções (impacto imediato, baixo risco)

**1. Corrigir a deteção de idioma**
Deixar a língua escrita pela pessoa ganhar ao locale da página. `locale` passa a ser fallback, não
override — só decide quando não há sinal claro no texto.
→ `route.ts:65-84`

**2. Matar as falsas escaladas** *(o maior ganho de qualidade)*
- Criar uma secção curta **"TÓPICOS COBERTOS — NUNCA ESCALAR"** imediatamente **antes** da regra
  absoluta nº2, com lista fechada: documentos, cancelamento/reembolso, ementas/alergias, prestações
  e métodos de pagamento, descontos de crianças, tipos de quarto, agência Bella Sul, o que
  está/não está incluído, passos da inscrição.
- Reescrever a regra nº2 para: *"Só escala se o dado for específico desta peregrinação e não constar
  de nenhum dos dois contextos."*
- Rede de segurança no servidor: se a resposta começar pelo marcador **e** a pergunta corresponder a
  um tópico coberto, registar `[chat] false-escalation` para medir a taxa depois da mudança.
- Avaliar subir para `gpt-4o` ou `gpt-4.1-mini` neste prompt — 160 linhas de instruções é muito para
  o `4o-mini`. Testar com as 10 perguntas mais frequentes.

**3. Tirar as contagens exatas de vagas do contexto**
Substituir `current_vacancies` / `effective_vacancies` por um rótulo (`Vagas limitadas` /
`Últimas vagas` / `Lista de espera`), reutilizando os helpers `getScarcitySold*` de `utils.ts`.
Alinha o chat com o resto do site e evita o "só resta uma vaga".
→ `fetchPilgrimageContext` + `buildPilgrimageContext`

**4. Dar contexto ao widget dentro do formulário**
```tsx
<ChatWidget … context="registration-form" registrationLink={…} pilgrimageId={pilgrimage?.id}
            currentStep={step} stepLabel={stepLabels[step-1]} />
```
E injetar no prompt: *"A pessoa está no passo N de M — «Alojamento». O passo seguinte é «Voos». O
botão final chama-se «Confirmar Inscrição»."*
→ resolve diretamente a conversa `67c55d42`.

**5. Corrigir a KB dos passos**
`01-inscricao.md` passa a ter os nomes reais: `Identificação → Dados das pessoas → Alojamento →
Voos (quando aplicável) → Doação`, botão final **"Confirmar Inscrição"**, e a nota de que depois da
confirmação segue a página de pagamento.

## P1 — Widgets de ação no chat *(o pedido central)*

**6. Generalizar o sistema de tokens `[[…]]`**
O `[[QUERO_IR]]` já provou que o mecanismo funciona. Transformar num conjunto que a IA pode emitir e
o widget converte em botões reais:

| Token | Botão | Destino |
|---|---|---|
| `[[INSCREVER]]` | Iniciar Inscrição | `registrationLink` |
| `[[LISTA_ESPERA]]` | Entrar na Lista de Espera | formulário de waitlist |
| `[[QUERO_IR]]` | Estou mesmo interessado em ir | WhatsApp pré-preenchido *(já existe)* |
| `[[PAGAR]]` | Pagar / ver o meu plano | `/peregrinacoes/minhas-inscricoes` |
| `[[MINHAS_INSCRICOES]]` | Ver as minhas inscrições | idem |
| `[[VOOS]]` | Ver Opções de Voo | secção de voos da página |
| `[[PDF]]` | Descarregar o roteiro | `/api/pilgrimages/[slug]/pdf` (+ `currency=BRL` se BR) |
| `[[WHATSAPP]]` | Falar no WhatsApp | `wa.me` *(hoje só sai com escalada)* |
| `[[CONTACTO]]` | Deixar o meu contacto | mini-formulário inline |

Implementação: estender `stripInterestMarker` para um `parseActionTokens(text)` que devolve
`{ visibleText, actions[] }` e renderiza uma linha de botões por baixo da bolha. É a mesma mecânica
já testada — o risco é baixo.

**7. Regras de emissão no prompt** (a parte que garante que os botões aparecem)
- Pergunta de preço / prestações / "como me inscrevo" numa peregrinação **com vagas** → terminar com
  `[[INSCREVER]]`. Corrige as ~26 conversas de intenção alta.
- "Já me inscrevi" / "como pago" / "onde pago a prestação" → `[[PAGAR]]` **e** lembrar dos 5 dias
  úteis da 1ª doação.
- Pedido de contacto humano ("falar com alguém", "whatsapp", frustração) → `[[WHATSAPP]]` **sempre**,
  sem depender do marcador de escalada. Resolve a Maria dos Anjos e o "Andreia".
- Lista de espera + vontade real → `[[QUERO_IR]]` + `[[LISTA_ESPERA]]`.
- **Nunca** citar o nome de um botão sem emitir o token correspondente. Corrige o caso do
  Marco Antônio.

**8. Barra de ação persistente no rodapé do chat**
Uma linha fixa por cima do input, sensível ao contexto — `Inscrever-me` na página pública,
`Continuar inscrição` no formulário, `Pagar 1ª doação` para quem já se inscreveu. O CTA deixa de
depender de a IA se lembrar dele.

**9. Widget de progresso da inscrição** (contexto `registration-form`)
Mini-stepper no topo do chat: `① Identificação ② Dados ③ Alojamento ④ Voos ⑤ Doação` com o passo
atual aceso, e um botão **"Ir para o próximo passo"**. Torna visualmente óbvio que a inscrição é o
formulário — e não a conversa.

**10. Cartão "Já me inscrevi — e agora?"**
Detetar a frase e mostrar um cartão com os 3 passos seguintes (1ª doação em 5 dias úteis → confirmação
por email → plano de prestações), com `[[PAGAR]]`. Resolve `1ec77bec`, `cd421032`, `6b68a21a`.

**11. Chips específicos do formulário**
Trocar os atuais por: *"Onde finalizo a inscrição?"*, *"Já preenchi tudo, e agora?"*,
*"Não consigo preencher um campo"*, *"Quanto pago agora?"*. Os chips atuais são todos informativos e
nenhum resolve o momento de bloqueio.

## P2 — Não perder leads nem sinais de avaria

**12. Deteção automática de contacto na mensagem**
Regex de email/telefone na mensagem do utilizador → gravar em `booking_leads` com
`status='chat_lead'` + slug + transcrição, e responder com um widget de confirmação
("✓ Guardámos o seu contacto — a equipa fala consigo"). Recupera Bernardete e Marco Antônio.

**13. Mostrar o lead-capture mais cedo**
Passar de "≥2 mensagens do utilizador" para **≥1 mensagem** (ou logo após a 1ª resposta em conversas
de intenção alta). Hoje 68% das conversas nunca o vêem.

**14. Alertas ao admin**
Email/WhatsApp quando uma conversa dispara: contacto partilhado, `[[QUERO_IR]]`, ou palavras de
avaria/frustração (*"não deixa"*, *"não consigo"*, *"onde finaliza"*, *"não estou a encontrar"*).
Os dois relatos de *"não deixa preencher o mail"* teriam sido apanhados no próprio dia.

**15. Novas colunas em `chat_conversations`**
`context`, `locale`, `escalated`, `lead_captured`, `action_tokens[]`, `flagged` — para o painel
`/admin/chat-conversations` poder filtrar por escaladas, leads e abandonos em vez de mostrar tudo em
bruto.

**16. Medir o funil**
Eventos PostHog: `chat_opened` → `chat_message_sent` → `chat_cta_clicked` (com o token) →
`registration_started`. Sem isto não se consegue provar que as mudanças resultaram.

## P3 — Conteúdo da KB

**17. Novo `10-pos-inscricao.md`** — "já me inscrevi, e agora?", prazo dos 5 dias úteis, onde pagar,
como ver o plano de prestações, o que acontece se falhar o prazo.

**18. Novo `11-problemas-tecnicos.md`** — email já usado/rejeitado, cada peregrino precisa de email
próprio, sessão expirada, o que fazer se o formulário bloquear (com `[[WHATSAPP]]` em vez de
conselhos genéricos de browser).

**19. Secção de câmbio EUR→BRL** — explicar que o valor oficial é em euros, que a conversão é
indicativa, e apontar sempre para o PDF em BRL. Não escalar esta pergunta.

**20. Regras de cálculo de grupo** — permitir explicitamente somar valores de família com os
descontos da KB, mostrando a composição do cálculo e a nota "confirmação final pela equipa".
Resolve `a458b445`.

**21. Investigar o bug do email** no passo de Identificação da Itália+Medjugorje (2 relatos no mesmo
dia, 27/07).

---

## Ordem sugerida

1. **Semana 1 — P0 (1-5).** São 5 correções pequenas e fechadas; matam as falsas escaladas, o bug de
   idioma, o número de vagas exposto e a confusão do formulário.
2. **Semana 2 — P1 (6-11).** O sistema de tokens é o coração do pedido: transforma o chat de
   informativo em transacional.
3. **Semana 3 — P2 (12-16).** Fecha o funil e dá visibilidade operacional.
4. **Contínuo — P3 (17-21).** KB e o bug do email.

## Como medir daqui a 30 dias
- taxa de escalada: **37% → <15%**
- conversas com ≥2 mensagens: **32% → >45%**
- conversas com clique num CTA do chat: **~5% → >25%**
- leads atribuídos ao chat: **0 → mensurável**
- zero conversas com nomes de passos ou de botões inexistentes
