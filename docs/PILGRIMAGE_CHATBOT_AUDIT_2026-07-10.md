# Auditoria do chatbot das peregrinações - 2026-07-10

## Amostra analisada

- 75 conversas guardadas em `chat_conversations`.
- 116 mensagens de utilizadores.
- Distribuição por página:
  - `peregrinacao-iberico-novembro-2026`: 63 conversas.
  - `peregrinacao-iberica-2026`: 10 conversas.
  - `maio2026`: 2 conversas.

## Temas mais frequentes

1. Preço, terrestre, quartos e suplemento individual: 28 perguntas.
2. Inscrição, vagas, lista de espera e interesse em ir: 19 perguntas.
3. Pagamento e prestações: 13 perguntas.
4. Voos/passagem aérea: 12 perguntas.
5. Cancelamento e seguro: 7 perguntas.
6. Documentos: 4 perguntas.
7. Roteiro/itinerário: 2 perguntas.

## Problemas encontrados

- Inglês: numa conversa em inglês, o bot respondeu primeiro em português com o marcador "Essa informação específica não tenho" e depois mencionou o botão "Iniciar Inscrição" numa resposta em inglês.
- Escalada excessiva: perguntas genéricas sobre documentos, cancelamento, menu/ementa e valores em BRL foram por vezes tratadas como "não sei", apesar de existirem respostas na KB.
- Fechos fracos: muitas respostas terminavam com frases genéricas como "Posso ajudar em mais alguma coisa?", em vez de fazer uma pergunta comercialmente útil.
- Copy desalinhado: a KB ainda dizia "Inscrever-me", enquanto a interface usa "Iniciar Inscrição" / "Start Registration".
- Conversão: respostas corretas sobre preço e voo muitas vezes não levavam a pessoa para o próximo micro-passo: origem, número de pessoas, maior dúvida ou WhatsApp/lista de espera.

## Alterações aplicadas

- Marcadores de escalada bilingues:
  - PT: `Essa informação específica não tenho`
  - EN: `I don't have that specific information`
- O widget agora reconhece ambos os marcadores e continua a mostrar CTA para WhatsApp/email.
- O endpoint `/api/chat` deteta idioma por `locale` e pelas últimas mensagens do utilizador.
- O prompt passa a forçar:
  - resposta em inglês quando o utilizador escreve em inglês;
  - nomes de botões em inglês: `Start Registration`, `Waiting List`, `I'm really interested in going`;
  - evitar fechos genéricos;
  - responder sem escalada a perguntas genéricas já cobertas pela KB: documentos, cancelamento, seguro, alimentação/menu.
- A KB de inscrição foi alinhada com os botões reais da UI.

## Próximas melhorias recomendadas

- Criar snippets bilingues curtos na KB para as perguntas campeãs: preço, voo, lista de espera, documentos e cancelamento.
- Guardar `locale`, `page_path` e `lead_captured` na tabela de conversas para medir conversão por idioma.
- Adicionar tags automáticas por conversa: `price`, `flight`, `waitlist`, `documents`, `cancellation`, `lead_intent`.
- Testar A/B duas aberturas do chat:
  - versão prática: "Ask me about price, flights, rooms or registration."
  - versão espiritual/comercial: "Not sure if this pilgrimage is for you? Tell me what is holding you back."
