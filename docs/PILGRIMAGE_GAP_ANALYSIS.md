# Análise de Funcionalidades em Falta - Sistema de Peregrinações

Este documento detalha as funcionalidades e secções em falta na aplicação atual em comparação com a página de referência fornecida, tanto para a visualização pública como para o painel de administração.

## 1. Página da Peregrinação (Público)

As seguintes secções existem na referência mas **não estão** implementadas ou visíveis na página atual da peregrinação:

### A. Logística e Horários
*   **O que falta**: Informação explícita sobre Ponto de Encontro e Horários.
*   **Exemplo da Referência**: *"INICIO: 09:00 da manhã, do dia 11 de Outubro... aeroporto de Lisboa"* e *"FIM: 16:00 horas... Paris"*.
*   **Estado Atual**: A *type* `Pilgrimage` tem campos como `flight_departure_time`, mas estes **não são renderizados** na página.

### B. "O Que Está Incluído" / "Não Incluído"
*   **O que falta**: Uma lista clara e estruturada do que o valor cobre e o que exclui.
*   **Exemplo da Referência**: Secção "PEREGRINAÇÃO - O QUE ESTÁ INCLUÍDO" com sub-items (Transporte, Pensão Completa, Seguros, etc.).
*   **Estado Atual**: Existe um campo `included_items` no tipo, mas **não existe secção visual** na página para mostrar esta lista.

### C. Detalhes de Preços e Pagamentos
*   **O que falta**:
    1.  **Opções de Parcelamento**: Informação sobre pagamento em prestações (ex: "até 8 pagamentos").
    2.  **Moedas Adicionais**: Preços em Reais (R$) para público brasileiro.
    3.  **Diferenciação Terrestre vs. Aéreo**: Explicação clara de que o valor é apenas terrestre.
*   **Estado Atual**: Apenas mostra `base_price` (Donativo Base) e `deposit_value`.

### D. Política de Cancelamento
*   **O que falta**: Uma secção ou modal dedicada à política de cancelamento e reembolso.
*   **Estado Atual**: Inexistente na página pública.

### E. Direção Espiritual e Organização
*   **O que falta**: Destaque específico para o Diretor Espiritual e Organizadores com biografia curta.
*   **Estado Atual**: Existe uma secção genérica de "Equipa", mas a referência dá um destaque hierárquico maior ao Diretor Espiritual e Organização.

---

## 2. Painel de Administração (Gestão)

Para suportar os pontos acima, o Admin precisa de poder gerir os seguintes novos campos:

### A. Editor de "Incluído / Não Incluído"
*   **Necessidade**: Capacidade de adicionar/remover itens de uma lista de inclusões (ex: "Pensão Completa", "Seguro", etc.) e exclusões.
*   **Sugestão**: Um campo de tags ou lista dinâmica onde o admin pode adicionar linhas de texto.

### B. Editor de Logística Específica
*   **Necessidade**: Campos de texto livre ou estruturados para:
    *   "Local/Hora de Encontro (Início)"
    *   "Local/Hora de Fim"
    *   "Informação sobre Voos" (texto livre para sugestões de voo).

### C. Configuração de Pagamento
*   **Necessidade**:
    *   Campo de texto para "Informação de Parcelamento" (ex: "Pague até 8x sem juros").
    *   Campo para "Preço em Moeda Secundária" (opcional, para Reais).

### D. Política de Cancelamento
*   **Necessidade**: Um campo de texto rico (Markdown/HTML) para definir a política de cancelamento específica desta viagem.

### E. Itinerário Detalhado (Melhoria)
*   **Necessidade**: O itinerário atual parece suportar título/descrição. Garantir que suporta imagens por dia, como na referência (cada dia tem uma foto ou destaque).

---

## 3. Resumo Técnico das Alterações Necessárias

### Base de Dados (Supabase)
*   **Tabela `pilgrimages`**:
    *   Adicionar coluna `meeting_point_text` (text).
    *   Adicionar coluna `payment_plan_text` (text).
    *   Adicionar coluna `cancellation_policy_text` (text).
    *   Adicionar coluna `not_included_items` (array de text/json).
    *   *(Nota: `included_items` já parece existir no tipo, verificar se existe na DB).*

### Frontend (`src/app/peregrinacoes/[slug]/page.tsx`)
*   Criar componente `DetailedLogistics` (Horários/Encontro).
*   Criar componente `InclusionsList` (O que inclui/não inclui).
*   Criar componente `PaymentInfo` (Parcelamento/Moedas).
*   Adicionar secção de "Política de Cancelamento" (possivelmente num accordion ou link para modal).

### Admin (`src/app/admin/...`)
*   Atualizar o formulário de criação/edição de peregrinações para incluir estes novos campos.
