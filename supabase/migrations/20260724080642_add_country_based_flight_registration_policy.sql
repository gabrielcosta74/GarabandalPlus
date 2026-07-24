update public.pilgrimages
set
  pricing_config = jsonb_set(
    jsonb_set(
      coalesce(pricing_config, '{}'::jsonb),
      '{flight_registration_policy}',
      jsonb_build_object(
        'kind', 'country_based_v1',
        'agency_required_countries', jsonb_build_array('PT', 'BR'),
        'self_arranged_rule', 'all_other_countries',
        'estimates_eur', jsonb_build_object(
          'BR', 1300,
          'PT', null
        ),
        'own_flight_schedule', jsonb_build_object(
          'rome_arrival', jsonb_build_object(
            'date', '2027-04-05',
            'by', '10:00',
            'timezone', 'Europe/Rome',
            'airport', 'Aeroporto Leonardo da Vinci/Fiumicino (FCO)'
          ),
          'rome_split', jsonb_build_object(
            'date', '2027-04-14',
            'period', 'afternoon'
          ),
          'split_home', jsonb_build_object(
            'date', '2027-04-17',
            'period', 'afternoon'
          )
        ),
        'agency_segments', jsonb_build_array(
          'residence_to_rome',
          'rome_to_split',
          'split_to_home'
        )
      ),
      true
    ),
    '{installment_deadline}',
    to_jsonb('2027-04-01'::text),
    true
  ),
  flight_info_text =
    'Os peregrinos residentes fora de Portugal e do Brasil compram as próprias passagens aéreas. Devem estar no Aeroporto Leonardo da Vinci/Fiumicino, em Roma, até às 10:00 do dia 5 de abril de 2027; reservar Roma–Split para a tarde de 14 de abril; e reservar Split–destino de regresso para a tarde de 17 de abril.',
  flight_info_text_en =
    'Pilgrims who live outside Portugal and Brazil arrange their own flights. They must be at Rome Leonardo da Vinci/Fiumicino Airport by 10:00 on 5 April 2027; book Rome–Split for the afternoon of 14 April; and book Split–home destination for the afternoon of 17 April.',
  group_flight_details =
    'Os peregrinos residentes em Portugal ou no Brasil têm obrigatoriamente de contratar o pacote aéreo através da agência de viagens indicada pelo Apostolado. O pacote inclui a ligação do país de residência a Roma, Roma–Split e Split–destino de regresso. O aéreo é pago diretamente à agência e não altera o valor terrestre da inscrição.',
  group_flight_details_en =
    'Pilgrims who live in Portugal or Brazil must purchase the air package through the travel agency appointed by the Apostolate. The package includes the journey from the country of residence to Rome, Rome–Split, and Split–home destination. Flights are paid directly to the agency and do not change the land-package registration total.'
where id = 'a7e2616e-fe39-48dc-968e-b14153c25325'::uuid;
