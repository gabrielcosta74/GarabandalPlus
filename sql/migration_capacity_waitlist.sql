-- 1. Create Waitlist Table
CREATE TABLE IF NOT EXISTS pilgrimage_waitlists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pilgrimage_id UUID REFERENCES pilgrimages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending' -- pending, notified, converted, cancelled
);

-- RLS for Waitlist
ALTER TABLE pilgrimage_waitlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own waitlist items"
    ON pilgrimage_waitlists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can join waitlist"
    ON pilgrimage_waitlists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin full access to waitlists"
    ON pilgrimage_waitlists FOR ALL
    USING (
        auth.email() IN ('geral@apostoladodegarabandal.com', 'rardo025@gmail.com')
    );

-- 2. Atomic Booking Function
CREATE OR REPLACE FUNCTION create_booking_atomic(
    p_pilgrimage_id UUID,
    p_user_id UUID,
    p_total_amount NUMERIC,
    p_pilgrim_data JSONB,
    p_payment_plan JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id UUID;
    v_view_token TEXT;
    v_current_vacancies INTEGER;
    v_total_vacancies INTEGER;
    v_pilgrim RECORD;
    v_slots_needed INTEGER;
BEGIN
    -- 1. Lock appropriate record to prevent race conditions
    SELECT total_vacancies, current_vacancies 
    INTO v_total_vacancies, v_current_vacancies
    FROM pilgrimages
    WHERE id = p_pilgrimage_id
    FOR UPDATE;

    -- 2. Validate Capacity
    v_slots_needed := jsonb_array_length(p_pilgrim_data);
    
    IF v_current_vacancies < v_slots_needed THEN
        RAISE EXCEPTION 'Not enough vacancies. Requested: %, Available: %', v_slots_needed, v_current_vacancies;
    END IF;

    -- 3. Create Booking
    v_view_token := encode(gen_random_bytes(32), 'hex');
    
    INSERT INTO bookings (
        user_id,
        pilgrimage_id,
        total_amount,
        status,
        notes,
        payment_plan,
        view_token,
        idempotency_key
    ) VALUES (
        p_user_id,
        p_pilgrimage_id,
        p_total_amount,
        'pending',
        p_notes,
        p_payment_plan,
        v_view_token,
        p_idempotency_key
    ) RETURNING id INTO v_booking_id;

    -- 4. Insert Pilgrims
    FOR v_pilgrim IN SELECT * FROM jsonb_to_recordset(p_pilgrim_data) AS x(
        full_name text, email text, phone text, birth_date date,
        sex text, address text, postal_code text, city text, country text,
        room_type text, flight_option text, allergies text, notes text,
        cpf_nif text, dietary_restrictions text, health_notes text,
        bed_preference text, sharing_mode text, roommate_name text
    )
    LOOP
        INSERT INTO pilgrims (
            booking_id, full_name, email, phone, birth_date,
            sex, address, postal_code, city, country,
            room_type, flight_option, allergies, notes,
            cpf_nif, dietary_restrictions, health_notes,
            bed_preference, sharing_mode, roommate_name
        ) VALUES (
            v_booking_id, v_pilgrim.full_name, v_pilgrim.email, v_pilgrim.phone, v_pilgrim.birth_date,
            v_pilgrim.sex, v_pilgrim.address, v_pilgrim.postal_code, v_pilgrim.city, v_pilgrim.country,
            v_pilgrim.room_type, v_pilgrim.flight_option, v_pilgrim.allergies, v_pilgrim.notes,
            v_pilgrim.cpf_nif, v_pilgrim.dietary_restrictions, v_pilgrim.health_notes,
            v_pilgrim.bed_preference, v_pilgrim.sharing_mode, v_pilgrim.roommate_name
        );
    END LOOP;

    -- 5. Update Vacancies
    UPDATE pilgrimages
    SET current_vacancies = current_vacancies - v_slots_needed
    WHERE id = p_pilgrimage_id;
    
    -- 6. Check if Full and Update Status (Optional, can be trigger, but explicit is fine)
    IF (v_current_vacancies - v_slots_needed) <= 0 THEN
        UPDATE pilgrimages SET status = 'waitlist' WHERE id = p_pilgrimage_id AND status = 'open';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'view_token', v_view_token
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
