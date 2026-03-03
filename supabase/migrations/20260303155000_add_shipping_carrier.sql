-- Add shipping_carrier column to store_orders to track the carrier used for each shipment
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS shipping_carrier TEXT;
