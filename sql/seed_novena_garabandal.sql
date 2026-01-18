-- Novena a Nossa Senhora do Carmo de Garabandal
-- Tema: Eucaristia, Sacerdócio, Penitência e Oração
-- Baseado nas Mensagens de Garabandal

DO $$
DECLARE
    v_novena_id UUID;
BEGIN
    -- 1. Inserir a Novena
    INSERT INTO novenas (title, slug, description, image_url, prayer_intro, prayer_final, published)
    VALUES (
        'Novena a Nossa Senhora de Garabandal',
        'novena-garabandal',
        'Uma jornada espiritual de 9 dias baseada nas mensagens de Garabandal, focada na importância central da Eucaristia, na santificação dos sacerdotes, e no apelo urgente à conversão, penitência e oração.',
        'https://m.media-amazon.com/images/I/71wY+GzAqvL._AC_UF1000,1000_QL80_.jpg', -- Placeholder, user can update via admin
        'Ó Maria, Mãe de Jesus e nossa Mãe, que em Garabandal nos chamastes à conversão, à penitência e ao amor à Eucaristia. Acolhei-nos sob o vosso manto sagrado neste dia, e ensinai-nos a ser verdadeiros apóstolos dos Últimos Tempos, fiéis à Igreja e ao Papa. Amém.',
        'Senhor Jesus, pelos vossos méritos infinitos e pela intercessão do Imaculado Coração de Maria, concedei-nos a graça que vos pedimos nesta novena. Fazei de nós testemunhas do vosso Amor e da vossa Misericórdia. Amém.',
        true
    )
    RETURNING id INTO v_novena_id;

    -- 2. Inserir os Dias
    INSERT INTO novena_days (novena_id, day_number, theme, content) VALUES
    -- Dia 1
    (v_novena_id, 1, 'O Chamamento à Santidade', 
    'A Aparição começa com um convite simples mas profundo: "É preciso fazer muitos sacrifícios e muita penitência". Em Garabandal, Nossa Senhora não pede o impossível, mas o essencial. A santidade começa na vida quotidiana, no cumprimento fiel dos nossos deveres de estado.\n\n"Temos de ser muito bons", dizia Ela. Ser bom não é apenas não fazer o mal, é amar a Deus sobre todas as coisas. Hoje, meditamos no nosso chamamento pessoal: Como estou a responder a este convite materno? Estou disposto a mudar a minha vida para agradar a Deus?'),

    -- Dia 2
    (v_novena_id, 2, 'A Centralidade da Eucaristia',
    'A mensagem de Garabandal é profundamente Eucarística. Vemos as meninas a comungar de forma angélica, lembrando-nos que Jesus está verdadeiramente presente no Santíssimo Sacramento. "Visitar o Santíssimo com frequência" foi um dos pedidos.\n\nA Eucaristia não é um símbolo, é o próprio Cristo Vivo. Nossa Senhora pede-nos que devolvamos a centralidade a Jesus Eucaristia nas nossas vidas. Que a Santa Missa seja o centro do nosso dia e não apenas uma obrigação semanal. Hoje, rezemos para que o nosso coração arda de amor sempre que recebemos Jesus.'),

    -- Dia 3
    (v_novena_id, 3, 'A Santificação dos Sacerdotes',
    'Na segunda mensagem, Nossa Senhora diz com tristeza: "Muitos cardeais, bispos e sacerdotes vão pelo caminho da perdição e com eles levam muitas almas". Isto não é uma crítica, mas um grito de socorro de uma Mãe.\n\nEla pede-nos oração intensa pelos nossos pastores. Sem sacerdotes, não temos Eucaristia. Sem Eucaristia, não temos Vida. O sacerdote deve ser "outro Cristo". Hoje, ofereçamos o nosso dia, os nossos sacrifícios e orações pela santificação de todos os sacerdotes, especialmente daqueles que estão em crise ou tentação, para que recuperem o fervor da sua consagração à Eucaristia.'),

    -- Dia 4
    (v_novena_id, 4, 'Penitência e Sacrifício',
    'A Virgem pediu "muita penitência". Mas que penitência? Não se trata apenas de grandes mortificações físicas, mas da penitência interior: aceitar com paciência as cruzes do dia a dia, sorrir quando estamos cansados, ser caridoso com quem nos ofende.\n\nOferecer pequenos sacrifícios pela conversão dos pecadores é a essência da mensagem. "Oferecei-os pelos vossos irmãos", dizia. O sacrifício tem valor redentor. Hoje, procura fazer pequenos atos de amor e renúncia escondidos, que só Deus veja.'),

    -- Dia 5
    (v_novena_id, 5, 'A Importância da Confissão',
    'Para receber a Eucaristia dignamente, a alma deve estar limpa. Garabandal recorda-nos a necessidade da Confissão frequente. O pecado afasta-nos de Deus, mas a Misericórdia restaura-nos.\n\nNão podemos viver na indiferença do pecado. Nossa Senhora quer-nos puros. Hoje, examinamos a nossa consciência: Há quanto tempo não faço uma boa confissão? Tenho vergonha dos meus pecados ou confio que o sangue de Cristo me pode lavar?'),

    -- Dia 6
    (v_novena_id, 6, 'Dar Menos Importância à Eucaristia?',
    'Uma das frases mais dolorosas da mensagem de 1965 foi: "À Eucaristia dá-se cada vez menos importância". Vemos hoje a profecia cumprida em muitos lugares: perda do sentido do sagrado, comunhões sacrílegas, falta de respeito na Casa de Deus.\n\nNós somos chamados a reparar este desamor. A sermos almas de adoração. A consolar o Coração de Jesus que é tantas vezes deixado sozinho nos tabernáculos. Hoje, façamos um ato de desagravo e adoração ao Santíssimo Sacramento.'),

    -- Dia 7
    (v_novena_id, 7, 'Oração pelos Pecadores',
    'Nossa Senhora em Garabandal mostrou-se preocupada com o destino eterno das almas. "Se não mudardes de vida, virá um castigo". O castigo não é vontade de Deus, mas consequência do afastamento do homem.\n\nA oração tem poder para mudar o mundo e salvar almas. Somos responsáveis espiritualmente pelos nossos irmãos. Hoje, rezemos o Terço com especial fervor, pedindo a conversão dos que estão mais afastados de Deus.'),

    -- Dia 8
    (v_novena_id, 8, 'A Espiritualidade dos Últimos Tempos',
    'Garabandal aponta para os "Últimos Tempos", tempos de confusão mas também de grande esperança. Nossa Senhora prometeu um Aviso para purificar a nossa consciência e um Milagre para confirmar a fé.\n\nNão devemos viver com medo, mas com vigilância. "Vigiai e orai". A melhor preparação para o futuro é viver santamente o presente. Hoje, renovemos a nossa esperança: Deus tem a última palavra e o Imaculado Coração de Maria triunfará.'),

    -- Dia 9
    (v_novena_id, 9, 'A Maternidade de Maria',
    'Em todas as aparições, Nossa Senhora comportou-se como uma verdadeira Mãe: beijava objetos religiosos, brincava com as meninas, preocupava-se com os detalhes. Ela não é uma rainha distante, é a nossa Mãe do Céu.\n\nEla quer guiar-nos a Jesus. "Fazei tudo o que Ele vos disser". Termina esta novena consagrando-te totalmente a Ela. Deixa que Ela modele o teu coração para ser mais semelhante ao do Seu Filho Sacerdote. Hoje, entrega-lhe todas as tuas preocupações.');

END $$;
