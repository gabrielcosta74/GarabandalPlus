-- ⚠️ ATENÇÃO: ISTO APAGA TODAS AS INSCRIÇÕES NA BASE DE DADOS ⚠️

-- 1. Apagar TODOS os Pagamentos de Peregrinações
DELETE FROM pilgrimage_payments;

-- 2. Apagar TODOS os Peregrinos
DELETE FROM pilgrims;

-- 3. Apagar TODAS as Reservas
DELETE FROM bookings;

-- Confirmação (Deve dar 0)
SELECT count(*) as total_reservas FROM bookings;
