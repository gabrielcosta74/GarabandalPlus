-- Seed: Novenas Batch 1 (Padre Pio, Santa Teresinha, São Miguel, Carlo Acutis)

-- 1. Padre Pio
WITH new_novena AS (
  INSERT INTO novenas (slug, title, description, prayer_intro, prayer_final, published, image_url)
  VALUES (
    'novena-padre-pio',
    'Novena a São Padre Pio',
    'Uma jornada de 9 dias com o santo dos estigmas, pedindo sua intercessão e aprendendo com sua vida de amor e sacrifício.',
    'Humildemente prostrado aos vossos pés, ó meu amável Jesus, venho implorar a vossa misericórdia e pedir a intercessão de São Padre Pio.',
    'Ó Deus, que concedestes a São Padre Pio de Pietrelcina a graça de participar, de modo admirável, da paixão de vosso Filho, concedei-nos, por sua intercessão, conformarmo-nos à morte de Jesus para chegarmos à glória da ressurreição. Por Cristo nosso Senhor. Amém.',
    true,
    'https://upload.wikimedia.org/wikipedia/commons/e/e3/Padre_Pio.jpg' -- Placeholder, admin can change
  ) RETURNING id
)
INSERT INTO novena_days (novena_id, day_number, theme, content)
SELECT id, day_num, theme, content
FROM new_novena, (VALUES
  (1, 'O Amor pela Cruz', 'São Padre Pio, que tanto amastes a Cruz de Cristo, ajudai-nos a aceitar os sofrimentos da vida como caminho de santificação. Ensinai-nos a sofrer com amor e paciência.'),
  (2, 'A Luta contra o Mal', 'Vós que combatestes o maligno com a oração e o jejum, fortalecei-nos nas tentações. Que vossa intercessão nos proteja de todo mal e perigo.'),
  (3, 'Devoção a Nossa Senhora', 'Padre Pio, filho predileto de Maria, alcançai-nos um amor filial à Mãe de Deus. Que o Rosário seja nossa arma e refúgio em todos os momentos.'),
  (4, 'O Anjo da Guarda', 'Vós que tinhas grande intimidade com o Anjo Custódio, ajudai-nos a ouvir e seguir as inspirações do nosso anjo guardião, companheiro fiel de nossa alma.'),
  (5, 'Caridade com os Sofredores', 'São Padre Pio, aliviai o sofrimento dos doentes e aflitos. Inspirai em nós a compaixão e o desejo de servir a Cristo nos irmãos mais necessitados.'),
  (6, 'O Valor da Confissão', 'Mestre da reconciliação, que passastes horas no confessionário, dai-nos a graça de uma contrição perfeita e o amor pelo sacramento do perdão.'),
  (7, 'Amor à Eucaristia', 'Vós que vivíeis a Santa Missa com tanto fervor, acendei em nós o amor por Jesus Eucarístico. Que a Comunhão seja o centro de nossa vida.'),
  (8, 'Obediência à Igreja', 'Filho fiel da Igreja, mesmo na provação, ensinai-nos a amar e obedecer à Santa Mãe Igreja e aos seus pastores com humildade.'),
  (9, 'Intercessão Poderosa', 'São Padre Pio, ficai conosco! Prometestes não entrar no Céu sem vossos filhos espirituais. Aceitai-nos como vossos filhos e guiai-nos até o Paraíso.')
) AS t(day_num, theme, content);

-- 2. Santa Teresinha
WITH new_novena AS (
  INSERT INTO novenas (slug, title, description, prayer_intro, prayer_final, published, image_url)
  VALUES (
    'novena-santa-teresinha',
    'Novena das Rosas (Santa Teresinha)',
    'A poderosa Novena das Rosas. Peça a intercessão da Santa do Pequeno Caminho e aguarde uma chuva de graças.',
    'Santíssima Trindade, Pai, Filho e Espírito Santo, eu Vos agradeço todos os favores, todas as graças com que enriquecestes a alma de vossa serva Santa Teresinha do Menino Jesus.',
    'Santa Teresinha do Menino Jesus e da Sagrada Face, rogai por nós. (Rezar 24 Glórias ao Pai em honra aos 24 anos de sua vida).',
    true,
    'https://upload.wikimedia.org/wikipedia/commons/2/23/Therese_de_Lisieux.jpg'
  ) RETURNING id
)
INSERT INTO novena_days (novena_id, day_number, theme, content)
SELECT id, day_num, theme, content
FROM new_novena, (VALUES
  (1, 'Doutora da Igreja', 'Santa Teresinha, Padroeira das Missões e Doutora da Igreja, rogai pelo Santo Padre, pelos Bispos e Sacerdotes. Alcançai-nos a graça de amar a Igreja como vós a amastes.'),
  (2, 'A Pequena Via', 'Ensinai-nos, ó Santa Teresinha, o Pequeno Caminho da infância espiritual: a confiança total e o abandono nos braços de Deus Pai.'),
  (3, 'O Sorriso de Maria', 'Vós que fostes curada pelo sorriso da Virgem, pedi a Mãe de Deus que sorria também para nós em nossas enfermidades e angústias.'),
  (4, 'Amor no Coração da Igreja', '"No coração da Igreja, minha Mãe, eu serei o Amor". Santa Teresinha, ajudai-nos a colocar amor em todas as nossas ações, por menores que sejam.'),
  (5, 'Humildade e Simplicidade', 'Fazei-nos simples de coração, longe da vaidade e do orgulho. Que saibamos encontrar Deus nas coisas ordinárias do dia a dia.'),
  (6, 'Zelo pelas Almas', 'Santa Teresinha, que desejastes salvar almas e rezastes pelos pecadores, despertai em nós o zelo missionário pela salvação de nossos irmãos.'),
  (7, 'A Sagrada Face', 'Vós que contemplastes a Face sofredora de Jesus, ajudai-nos a reconhecê-Lo nos pobres e sofredores e a consolá-Lo com nosso amor.'),
  (8, 'Chuva de Rosas', 'Cumprí vossa promessa, ó Santinha, de fazer cair uma chuva de rosas sobre a terra. Derramai sobre mim e minha família as graças que necessitamos.'),
  (9, 'Desejo do Céu', 'Santa Teresinha, que dissestes "Não morro, entro na vida", dai-nos a esperança do Céu e a certeza de que Deus nos espera de braços abertos.')
) AS t(day_num, theme, content);

-- 3. São Miguel Arcanjo
WITH new_novena AS (
  INSERT INTO novenas (slug, title, description, prayer_intro, prayer_final, published, image_url)
  VALUES (
    'novena-sao-miguel',
    'Novena a São Miguel Arcanjo',
    'Invoque o Príncipe da Milícia Celeste para proteção espiritual, combate ao mal e fortaleza na fé.',
    'São Miguel Arcanjo, defendei-nos no combate, sede o nosso refúgio contra as maldades e ciladas do demônio.',
    'Oração Final: Glorioso São Miguel Arcanjo, príncipe da milícia celeste, sede o nosso fiel protetor contra todos os males visíveis e invisíveis. Amém.',
    true,
    'https://upload.wikimedia.org/wikipedia/commons/3/36/Guido_Reni_031.jpg'
  ) RETURNING id
)
INSERT INTO novena_days (novena_id, day_number, theme, content)
SELECT id, day_num, theme, content
FROM new_novena, (VALUES
  (1, 'Quem como Deus?', 'São Miguel, ensinai-nos a colocar Deus acima de todas as coisas. Que o vosso grito "Quem como Deus?" ressoe em nossos corações contra todo ídolo.'),
  (2, 'Humildade Vitoriosa', 'Vencedor do orgulho de Lúcifer, alcançai-nos a virtude da humildade. Que reconheçamos que todo bem vem de Deus.'),
  (3, 'Defensor da Igreja', 'Protegei a Santa Igreja, o Papa e todos os fiéis. Afastai todo erro e divisão, e dai-nos a unidade na fé.'),
  (4, 'Morte Santa', 'São Miguel, padroeiro da boa morte, assisti-nos em nossos últimos momentos. Levai nossa alma à presença de Deus no dia final.'),
  (5, 'Livrai-nos do Mal', 'Combatei por nós, ó Príncipe Celeste, contra as ciladas do inimigo. Livrai-nos das tentações e do pecado mortal.'),
  (6, 'Adorador Perfeito', 'Vós que estais diante do trono de Deus, ensinai-nos a adorar o Senhor em espírito e verdade, com reverência e amor.'),
  (7, 'Auxílio nas Batalhas', 'Nas batalhas espirituais e temporais da vida, vinde em nosso auxílio. Dai-nos coragem para enfrentar as dificuldades com fé.'),
  (8, 'Guardião do Purgatório', 'Orai pelas almas do Purgatório, vós que sois seu anjo consolador. Levai-as para a luz eterna do Céu.'),
  (9, 'Consagração', 'São Miguel, a vós nos consagramos. Protegei nossa família, nosso trabalho e nossa vocação. Guiai-nos sempre no caminho da salvação.')
) AS t(day_num, theme, content);

-- 4. Beato Carlo Acutis
WITH new_novena AS (
  INSERT INTO novenas (slug, title, description, prayer_intro, prayer_final, published, image_url)
  VALUES (
    'novena-carlo-acutis',
    'Novena ao Beato Carlo Acutis',
    'Para os jovens e todos que buscam a santidade na era digital. "A Eucaristia é a minha autoestrada para o Céu".',
    'Santíssima Trindade, Pai, Filho e Espírito Santo, eu Vos agradeço todos os favores, todas as graças com que enriquecestes a alma do Beato Carlo Acutis durante os 15 anos que passou nesta terra.',
    'Deus Pai de Misericórdia, elevai à honra dos altares o vosso servo Carlo Acutis, para que por ele Vós sejais mais glorificado. Amém.',
    true,
    'https://upload.wikimedia.org/wikipedia/commons/e/e5/Carlo_Acutis.jpg'
  ) RETURNING id
)
INSERT INTO novena_days (novena_id, day_number, theme, content)
SELECT id, day_num, theme, content
FROM new_novena, (VALUES
  (1, 'Não eu, mas Deus', 'Carlo renunciou a tudo para colocar Deus em primeiro lugar. Senhor, ajudai-nos a buscar não a nossa vontade, mas a Vossa santidade.'),
  (2, 'Projeto de Vida', '"Estar sempre com Jesus, este é o meu projeto de vida". Que possamos, como Carlo, fazer de Jesus nosso melhor amigo e companheiro constante.'),
  (3, 'O Anjo Amigo', 'Carlo tinha grande amizade com seu Anjo da Guarda. Que aprendamos a invocar e amar nosso anjo protetor todos os dias.'),
  (4, 'A Eucaristia', 'A "Autoestrada para o Céu". Carlo amava a Missa diária e a Adoração. Senhor, aumentai nossa fé e amor pela Sagrada Eucaristia.'),
  (5, 'Confissão Frequente', '"Como um balão precisa soltar pesos para subir, a alma precisa da Confissão para voar até Deus". Dai-nos o amor pela pureza de coração.'),
  (6, 'Santidade na Internet', 'Apóstolo da Internet, Carlo usou a tecnologia para evangelizar. Que saibamos usar os meios digitais para o bem e a verdade.'),
  (7, 'Amor aos Pobres', 'Carlo era generoso com os moradores de rua e necessitados. Ensinai-nos a caridade concreta e o desapego dos bens materiais.'),
  (8, 'Alegria de Viver', '"A tristeza é o olhar voltado para si; a felicidade é o olhar voltado para Deus". Dai-nos a alegria verdadeira que nasce da fé.'),
  (9, 'Originalidade', '"Todos nascem originais, mas muitos morrem como fotocópias". Senhor, ajudai-nos a realizar a missão única que tens para cada um de nós.')
) AS t(day_num, theme, content);
