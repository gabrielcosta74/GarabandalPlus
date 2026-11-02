# Estudo de base de conversão das peregrinações (novembro de 2026)

Feito a 2026-11-02 com os dados históricos do Supabase. Não usa o tracking próprio, que só começou a 2026-11-02.
Ficaram de fora as peregrinações de teste e as de demonstração (Google Play, FACT.pt).

**Peregrinações analisadas**

| Peregrinação | Inscrições | Peregrinos | Estado | Lista de espera |
|---|---|---|---|---|
| Caminho Ibérico, novembro de 2026 | 49 | 63 | fechada | 21 |
| Itália e Medjugorje, abril de 2027 | 63 | 79 | esgotada | 30 |
| Caminho Mariano, outubro de 2027 | 28 | 37 | aberta desde 13/10 | 21 |
| **Total** | **140** | **179** | | |

## Resumo

1. **Há um erro ativo nos emails de recuperação.** 58 emails "a sua inscrição ficou por concluir" foram enviados a pessoas que já estavam inscritas na peregrinação: 34% de todos os envios desses emails, 15 nos últimos 30 dias e o último ontem. É urgente.
2. **A procura é maior do que as vagas.** A Itália esgotou em cerca de 2 meses e tem 30 pessoas em lista de espera. As perguntas mais repetidas no chat dessa peregrinação são "há hipótese de abrir mais vagas?" e "ainda dá para entrar?". O maior ganho pode estar em ter mais lugares ou mais datas, e não só em melhorar a página.
3. **As listas de pessoas interessadas vendem; os envios em massa quase não vendem.** Emails para quem está em lista de espera ou tem acesso antecipado: 16 a 22% inscrevem-se na semana seguinte. Campanhas para ~1000 contactos: 0,1 a 0,5%.
4. **Os EUA são o público que mais cresce e o que mais conclui.** Pesam 0% no Ibérico, 27% na Itália e 43% na Mariana. 78% dos americanos que começam a inscrição acabam por se inscrever.
5. **Os portugueses desistem muito.** Só 38% de quem começa conclui, contra 62% no Brasil e 78% nos EUA.
6. **O público-tipo:** mulher (80%), com mais de 60 anos (59%), a inscrever-se sozinha (77% das inscrições são de uma pessoa).

## 1. Quem compra

**Países** (país indicado na inscrição, já normalizado):

| | Brasil | EUA | Portugal | Outros |
|---|---|---|---|---|
| Ibérico 2026 | 76% | 0% | 19% | 5% |
| Itália 2027 | 62% | 27% | 9% | 2% |
| Mariana 2027 | 51% | 43% | 5% | 0% |

**Idade no momento da inscrição** (179 peregrinos):

| Menos de 40 | 40–49 | 50–59 | 60–69 | 70–79 | 80+ |
|---|---|---|---|---|---|
| 15 (8%) | 23 (13%) | 35 (20%) | 72 (40%) | 31 (17%) | 3 (2%) |

- **Sexo:** 80% mulheres (143 de 179).
- **Tamanho da inscrição:** 77% são de 1 pessoa, 19% de 2 pessoas e 4% de 3 ou mais.
- **Quartos:** a grande maioria escolhe duplo. Na Itália, 24 pessoas escolheram partilhar quarto com outro peregrino.
- **Voos:** na Itália, 63% voou com a agência. Na Mariana, 57% trata do próprio voo.

**O que isto quer dizer:** o público é sobretudo de mulheres com mais de 60 anos que viajam sozinhas, usam o telemóvel e tomam a decisão com calma. A confiança, a clareza e o apoio humano pesam mais do que a urgência.

## 2. Quem desiste

Contei quem chegou a dar o email no formulário e depois aparece, ou não, como peregrino dessa peregrinação. O país sai do indicativo do telefone.

| País | Começaram | Concluíram | Taxa |
|---|---|---|---|
| Brasil | 143 | 89 | 62% |
| EUA | 36 | 28 | 78% |
| Portugal | 40 | 15 | **38%** |

- A diferença de Portugal repete-se nas 3 peregrinações (Ibérico 7 de 15, Itália 6 de 11, Mariana 1 de 9), por isso não parece acaso.
- Hipóteses a confirmar com o tracking: formas de pagamento (MB WAY ou referência), o pedido de NIF, o preço sem voo, ou preferirem tratar das coisas por telefone ou WhatsApp.
- **Correção ao que disse antes:** o estado do lead fica em `draft` mesmo depois de a pessoa se inscrever. Na Mariana não há 48 desistências, há cerca de 20. Nos 3 grupos, a conclusão do formulário anda nos 60 a 65% e não nos 35%.

## 3. Pagamentos e timing

| | Dias antes da partida (média) | Dias até à taxa de inscrição (mediana) | Sem taxa confirmada | % pago (média) |
|---|---|---|---|---|
| Ibérico 2026 | 187 | 69,5* | 0 | 97% |
| Itália 2027 | 245 | 13 | 1 | 52% |
| Mariana 2027 | 355 | 0,3 | **8 de 28** | 15% |

\* O Ibérico inclui inscrições migradas do sistema antigo, por isso este valor não é comparável.

- **Na Mariana, 8 das 28 inscrições ainda não pagaram a taxa de inscrição.** Contactá-las vale mais do que trazer 8 visitas novas.
- As pessoas inscrevem-se muito cedo, 6 a 12 meses antes da partida. A decisão é longa, e o acompanhamento entre o primeiro contacto e a inscrição conta.
- Na Itália, as inscrições concentram-se à segunda e ao sábado, os dias dos envios da campanha, e de manhã (hora de Brasília).

## 4. O que os emails trazem

Pessoas que se inscreveram até 7 dias depois de receberem cada email. É uma associação, não uma prova de causa: quem está numa lista já tinha intenção.

| Email | Enviados | Inscreveram-se em 7 dias | Taxa |
|---|---|---|---|
| Boas-vindas à lista de espera | 69 | 14 | 20% |
| Vaga aberta (lista de espera) | 50 | 11 | 22% |
| Código de acesso antecipado | 43 | 7 | 16% |
| Recuperação de inscrição (1.º) | 69 | 10 | 14%** |
| Lançamento Itália | 989 | 5 | 0,5% |
| História Itália | 1133 | 1 | 0,1% |
| Convite Mariana 2027 | 906 | 1 | 0,1% |
| Anúncio do site | 297 | 0 | 0% |

\*\* Dos 69 envios, 20 foram para pessoas já inscritas. Contando só quem ainda não estava inscrito, ronda os 20%.

**Conclusão:** o que funciona é juntar pessoas interessadas antes do lançamento (lista de espera, acesso antecipado, "estou interessado") e falar com elas de forma pessoal. Os envios em massa para a base inteira trazem muito pouco e gastam a atenção da lista.

## 5. O que perguntam no chat

155 conversas. Temas mais frequentes (uma conversa pode ter vários):

| Tema | Conversas |
|---|---|
| Preço | 32 |
| Pagamento e prestações | 25 |
| Vagas e lista de espera ("ainda dá para entrar?") | 18 |
| Voos | 16 |
| Cancelamento e reembolso | 14 |
| Quarto (sozinho ou partilhado) | 11 |
| O que está incluído | 10 |
| Documentos e seguro | 8 |

Muitas destas perguntas vêm dos botões de sugestão do chat. Mesmo assim, o cancelamento e a pergunta sobre se a taxa é reembolsável aparecem em texto livre, sobretudo de americanos.

**Queixas do formulário escritas no chat:** "it won't let me input the name", "the day is not inputting correctly", "não me deixa preencher o mail" (duas vezes) e "the app won't open". São poucas, mas cada uma é uma inscrição em risco. O tracking novo (`registration_validation_failed`) vai mostrar quantas pessoas batem nestes campos.

## 6. Ações por prioridade

| # | Ação | Porquê | Esforço |
|---|---|---|---|
| 1 | **Corrigir o funil de "inscrição abandonada"**: contar também os peregrinos (não só as inscrições ligadas à conta), confirmar por peregrinação e marcar o lead como `converted` quando a pessoa se inscreve. Até lá, ponderar pausar este funil na Marketing Platform. | 58 emails errados a inscritos, o último ontem | Baixo |
| 2 | **Contactar as 8 inscrições da Mariana sem taxa paga.** | 29% das inscrições estão paradas | Baixo |
| 3 | **Decidir capacidade:** um 2.º grupo, mais vagas ou uma data nova para a Itália e para o Caminho Ibérico. Avisar primeiro as listas de espera (72 pessoas). | A procura é maior do que as vagas | Decisão |
| 4 | **Fazer de cada lançamento uma lista de interesse primeiro:** recolher "estou interessado" ou acesso antecipado antes de abrir, e lançar para essa lista. Reduzir os envios em massa. | 16–22% contra 0,1–0,5% | Médio |
| 5 | **Cuidar do público dos EUA:** página e emails em inglês, preço em dólares visível, voos a partir dos EUA explicados, e a política de cancelamento e da taxa clara em inglês. | Passaram de 0% para 43% e são os que mais concluem | Médio |
| 6 | **Perceber porque desistem os portugueses:** com o tracking, ver em que passo param. Ligar a 3 ou 4 dessas pessoas e perguntar. | 38% contra 62–78% | Baixo |
| 7 | **Adaptar a página e o formulário ao público 60+ que vai sozinho:** letra maior, campos maiores, "vai sozinha? partilha quarto com outra peregrina" em destaque, WhatsApp humano bem visível, política de cancelamento escrita de forma simples. | 59% com mais de 60 anos, 77% inscrições individuais, 14 perguntas sobre cancelamento | Médio |
| 8 | **Investigar os campos nome, data e email do formulário** com os dados do tracking nas próximas 2 a 4 semanas. | Queixas no chat | Baixo |
| 9 | **Limpar os dados:** normalizar países (BR/Brasil, US/United States) e acrescentar a pergunta opcional "Como conheceu esta peregrinação?". | Sem isto, as próximas análises erram | Baixo |

## Limitações

- São 140 inscrições em 3 peregrinações com preços, destinos e públicos diferentes. As percentagens dão a direção, não números exatos.
- O país dos leads vem do indicativo do telefone, e o dos peregrinos vem do país da morada. Há quem viva fora do país de origem.
- A ligação entre emails e inscrições é feita pelo email, que pode ser diferente entre o lead, a conta e o peregrino. Algumas ligações escapam, por isso os números podem estar subestimados.
- O comportamento na página (o que leem, onde clicam, onde desistem no formulário) só passa a existir com o tracking próprio, a partir de 2026-11-02.
