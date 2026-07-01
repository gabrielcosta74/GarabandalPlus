insert into public.marketing_funnels (name, slug, description, trigger_type, segment_slug, steps, status)
values (
  'Waitlist nurture',
  'waitlist-nurture',
  'Nutrir contactos em lista de espera com valor espiritual, livros oficiais, missão e convite suave para membro enquanto aguardam vaga real.',
  'waitlist_joined',
  'waitlist-contacts',
  '[
    {
      "delay_hours": 72,
      "channel": "email",
      "template_key": "waitlist_garabandal_story",
      "condition": "not_booked",
      "stop_if": ["booked_pilgrimage", "suppressed", "unsubscribed"]
    },
    {
      "delay_hours": 168,
      "channel": "email",
      "template_key": "waitlist_book_recommendation",
      "condition": "not_booked",
      "stop_if": ["booked_pilgrimage", "suppressed", "unsubscribed"]
    },
    {
      "delay_hours": 336,
      "channel": "email",
      "template_key": "waitlist_mission_support",
      "condition": "not_booked",
      "stop_if": ["booked_pilgrimage", "suppressed", "unsubscribed"]
    },
    {
      "delay_hours": 576,
      "channel": "email",
      "template_key": "waitlist_member_invitation",
      "condition": "not_booked,not_member",
      "stop_if": ["booked_pilgrimage", "became_member", "suppressed", "unsubscribed"]
    },
    {
      "delay_hours": 840,
      "channel": "task",
      "template_key": "waitlist_manual_follow_up",
      "condition": "not_booked",
      "stop_if": ["booked_pilgrimage", "suppressed", "unsubscribed"]
    }
  ]'::jsonb,
  'draft'
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    trigger_type = excluded.trigger_type,
    segment_slug = excluded.segment_slug,
    steps = excluded.steps,
    status = case
      when public.marketing_funnels.status = 'active' then public.marketing_funnels.status
      else excluded.status
    end,
    updated_at = now();
