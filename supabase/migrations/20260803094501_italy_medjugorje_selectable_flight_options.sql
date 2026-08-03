-- Restore a direct flight choice for new Italy + Medjugorje registrations.
-- This changes only the pilgrimage configuration. Existing bookings and
-- pilgrims, including their stored flight_option values, are intentionally
-- left untouched.
update public.pilgrimages
set
  pricing_config = (
    coalesce(pricing_config, '{}'::jsonb) - 'flight_registration_policy'
  ) || jsonb_build_object(
    'flight_registration_options',
    jsonb_build_array('own', 'agency')
  ),
  flight_info_text =
    'Voo próprio: o peregrino compra as suas próprias passagens. Deve estar no Aeroporto Leonardo da Vinci/Fiumicino, em Roma, até às 10:00 do dia 5 de abril de 2027; reservar Roma–Split para a tarde de 14 de abril; e reservar Split–destino de regresso para a tarde de 17 de abril.',
  flight_info_text_en =
    'Own flight: the pilgrim purchases their own tickets. They must be at Rome Leonardo da Vinci/Fiumicino Airport by 10:00 on 5 April 2027; book Rome–Split for the afternoon of 14 April; and book Split–home destination for the afternoon of 17 April.',
  group_flight_details =
    '<p><strong>Voo de grupo:</strong> o peregrino contrata o pacote aéreo através da agência de viagens indicada pelo Apostolado. O pacote inclui a ligação do país de residência a Roma, Roma–Split e Split–destino de regresso. O aéreo é pago diretamente à agência e não altera o valor terrestre da inscrição.</p>',
  group_flight_details_en =
    '<p><strong>Group flight:</strong> the pilgrim purchases the air package through the travel agency appointed by the Apostolate. The package includes the journey from the country of residence to Rome, Rome–Split, and Split–home destination. Flights are paid directly to the agency and do not change the land-package registration total.</p>'
where id = 'a7e2616e-fe39-48dc-968e-b14153c25325'::uuid
  and slug = 'italia-medjugorje-abril-2027';
