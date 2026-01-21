-- Debug Payment Calculation Issues
-- Run this to check a specific booking's payment data

-- Replace 'BOOKING_ID_HERE' with the actual booking ID you're debugging
-- Example: WHERE b.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

SELECT 
    '=== BOOKING INFO ===' as section,
    b.id as booking_id,
    b.status,
    b.paid_amount,
    b.total_amount,
    b.payment_plan,
    p.title as pilgrimage_title,
    p.deposit_value,
    p.base_price
FROM bookings b
LEFT JOIN pilgrimages p ON b.pilgrimage_id = p.id
WHERE b.id = 'BOOKING_ID_HERE';

-- Check all payments for this booking
SELECT 
    '=== PAYMENTS ===' as section,
    pp.id,
    pp.amount,
    pp.method,
    pp.status,
    pp.created_at,
    pp.notes
FROM pilgrimage_payments pp
WHERE pp.booking_id = 'BOOKING_ID_HERE'
ORDER BY pp.created_at ASC;

-- Calculate expected vs actual
SELECT 
    '=== FINANCIAL SUMMARY ===' as section,
    b.paid_amount as booking_paid_amount,
    COALESCE(SUM(CASE WHEN pp.status IN ('verified', 'succeeded') THEN pp.amount ELSE 0 END), 0) as sum_verified_payments,
    b.paid_amount - COALESCE(SUM(CASE WHEN pp.status IN ('verified', 'succeeded') THEN pp.amount ELSE 0 END), 0) as difference,
    p.deposit_value,
    b.total_amount - p.deposit_value as remaining_after_deposit,
    b.total_amount - b.paid_amount as total_remaining
FROM bookings b
LEFT JOIN pilgrimages p ON b.pilgrimage_id = p.id
LEFT JOIN pilgrimage_payments pp ON pp.booking_id = b.id
WHERE b.id = 'BOOKING_ID_HERE'
GROUP BY b.id, p.id;

-- Check payment plan structure
SELECT 
    '=== PAYMENT PLAN BREAKDOWN ===' as section,
    jsonb_array_elements(b.payment_plan) as installment
FROM bookings b
WHERE b.id = 'BOOKING_ID_HERE';

-- Get the latest 5 bookings for quick reference
SELECT 
    '=== RECENT BOOKINGS (for ID reference) ===' as section,
    b.id,
    b.created_at,
    b.paid_amount,
    b.total_amount,
    p.title,
    COUNT(pg.id) as pilgrim_count
FROM bookings b
LEFT JOIN pilgrimages p ON b.pilgrimage_id = p.id
LEFT JOIN pilgrims pg ON pg.booking_id = b.id
GROUP BY b.id, p.id
ORDER BY b.created_at DESC
LIMIT 5;
