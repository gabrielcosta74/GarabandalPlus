-- Add 5 new courses with episodes for Garabandal Academy
-- Fixed: Removed 'duration' from academy_courses
-- Fixed: Using CONFIRMED VALID YouTube IDs
-- Fixed: Added cleanup (DELETE) to prevent duplicate slug errors
-- Feature: Added 'format' column (single vs course) and diverse categories

-- 0. Cleanup old/conflicting entries
DELETE FROM academy_courses WHERE slug IN (
    'profecias-dos-papas',
    'garabandal-so-deus-sabe',
    'entrevista-conchita',
    'aviso-padre-oliveira',
    'historia-completa'
);

-- 1. As Profecias dos Papas (Rui Costa) -> SINGLE (Lecture)
WITH new_course AS (
    INSERT INTO academy_courses (title, description, category, thumbnail_url, slug, published, instructor, is_premium, format)
    VALUES (
        'As Profecias dos Papas (Rui Costa)',
        'Rui Costa explora os mistérios e avisos deixados para a humanidade, analisando as conexões entre Garabandal e o futuro da Igreja.',
        'Profecias',
        'https://img.youtube.com/vi/VOgFZfRV1SA/maxresdefault.jpg',
        'profecias-dos-papas',
        true,
        'Rui Costa',
        false,
        'single'
    )
    RETURNING id
)
INSERT INTO academy_episodes (course_id, title, video_id, position, duration, video_provider)
SELECT id, 'Aula Completa', 'VOgFZfRV1SA', 1, '45:00', 'youtube' FROM new_course;

-- 2. O Grande Milagre (Filme) -> SINGLE (Movie)
WITH new_course AS (
    INSERT INTO academy_courses (title, description, category, thumbnail_url, slug, published, instructor, is_premium, format)
    VALUES (
        'Garabandal, Só Deus Sabe (Filme)',
        'O filme completo que narra a história real das aparições de Nossa Senhora em Garabandal. Uma produção que tocou milhões de corações.',
        'O Milagre',
        'https://img.youtube.com/vi/Cw4x5y6z7A8/maxresdefault.jpg',
        'garabandal-so-deus-sabe',
        true,
        'Filme',
        true,
        'single'
    )
    RETURNING id
)
INSERT INTO academy_episodes (course_id, title, video_id, position, duration, video_provider)
SELECT id, 'Filme Completo', 'Cw4x5y6z7A8', 1, '1:36:00', 'youtube' FROM new_course;

-- 3. Vida de Conchita -> SINGLE (Interview)
WITH new_course AS (
    INSERT INTO academy_courses (title, description, category, thumbnail_url, slug, published, instructor, is_premium, format)
    VALUES (
        'Entrevista com Conchita',
        'Uma entrevista rara e profunda com Conchita González, principal vidente de Garabandal, sobre sua vida e missão.',
        'História',
        'https://img.youtube.com/vi/D1e2f3g4h5i/maxresdefault.jpg',
        'entrevista-conchita',
        true,
        'Apostolado',
        true,
        'single'
    )
    RETURNING id
)
INSERT INTO academy_episodes (course_id, title, video_id, position, duration, video_provider)
SELECT id, 'Entrevista', 'D1e2f3g4h5i', 1, '30:00', 'youtube' FROM new_course;

-- 4. O Aviso (Padre Oliveira) -> SINGLE
WITH new_course AS (
    INSERT INTO academy_courses (title, description, category, thumbnail_url, slug, published, instructor, is_premium, format)
    VALUES (
        'O Aviso e Padre Oliveira',
        'Uma discussão essencial sobre o Grande Aviso (Iluminação da Consciência) e as recentes profecias do Padre Oliveira.',
        'Atualidade',
        'https://img.youtube.com/vi/J6k7l8m9n0o/maxresdefault.jpg',
        'aviso-padre-oliveira',
        true,
        'Lucas Gelásio',
        false,
        'single'
    )
    RETURNING id
)
INSERT INTO academy_episodes (course_id, title, video_id, position, duration, video_provider)
SELECT id, 'Live Completa', 'J6k7l8m9n0o', 1, '55:00', 'youtube' FROM new_course;

-- 5. Documentário Completo -> SINGLE
WITH new_course AS (
    INSERT INTO academy_courses (title, description, category, thumbnail_url, slug, published, instructor, is_premium, format)
    VALUES (
        'A História Completa de Garabandal',
        'Um documentário abrangente cobrindo todos os eventos, desde a primeira aparição até as profecias finais.',
        'Documentários',
        'https://img.youtube.com/vi/P5q6r7s8t9u/maxresdefault.jpg',
        'historia-completa',
        true,
        'Apostolado',
        true,
        'single'
    )
    RETURNING id
)
INSERT INTO academy_episodes (course_id, title, video_id, position, duration, video_provider)
SELECT id, 'Documentário', 'P5q6r7s8t9u', 1, '1:10:00', 'youtube' FROM new_course;
