-- Payment System Schema Verification
-- This script verifies the database structure for the admin payment system

-- 1. Check pilgrimage table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'pilgrimages'
    AND column_name IN ('id', 'title', 'deposit_value', 'base_price', 'min_deposit')
ORDER BY ordinal_position;

-- 2. Check bookings table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
    AND column_name IN ('id', 'pilgrimage_id', 'paid_amount', 'total_amount', 'payment_plan', 'status')
ORDER BY ordinal_position;

-- 3. Check pilgrimage_payments table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'pilgrimage_payments'
ORDER BY ordinal_position;

-- 4. Sample data verification - Check a booking with its pilgrimage data
SELECT 
    b.id as booking_id,
    b.status,
    b.paid_amount,
    b.total_amount,
    b.payment_plan,
    p.id as pilgrimage_id,
    p.title as pilgrimage_title,
    p.deposit_value,
    p.base_price,
    COUNT(pp.id) as payment_count,
    COALESCE(SUM(pp.amount), 0) as total_payments_sum
FROM bookings b
LEFT JOIN pilgrimages p ON b.pilgrimage_id = p.id
LEFT JOIN pilgrimage_payments pp ON pp.booking_id = b.id AND pp.status IN ('verified', 'succeeded')
GROUP BY b.id, p.id
ORDER BY b.created_at DESC
LIMIT 5;

-- 5. Check for any bookings with missing pilgrimage data
SELECT 
    b.id,
    b.pilgrimage_id,
    CASE 
        WHEN p.id IS NULL THEN 'MISSING PILGRIMAGE'
        WHEN p.deposit_value IS NULL THEN 'MISSING DEPOSIT_VALUE'
        WHEN p.base_price IS NULL THEN 'MISSING BASE_PRICE'
        ELSE 'OK'
    END as data_status
FROM bookings b
LEFT JOIN pilgrimages p ON b.pilgrimage_id = p.id
WHERE p.id IS NULL 
    OR p.deposit_value IS NULL 
    OR p.base_price IS NULL
LIMIT 10;

-- 6. Payment consistency check - Compare paid_amount with actual payment records
SELECT 
    b.id,
    b.paid_amount as booking_paid_amount,
    COALESCE(SUM(CASE WHEN pp.status IN ('verified', 'succeeded') THEN pp.amount ELSE 0 END), 0) as actual_payments_sum,
    b.paid_amount - COALESCE(SUM(CASE WHEN pp.status IN ('verified', 'succeeded') THEN pp.amount ELSE 0 END), 0) as difference
FROM bookings b
LEFT JOIN pilgrimage_payments pp ON pp.booking_id = b.id
GROUP BY b.id
HAVING ABS(b.paid_amount - COALESCE(SUM(CASE WHEN pp.status IN ('verified', 'succeeded') THEN pp.amount ELSE 0 END), 0)) > 0.01
LIMIT 10;
