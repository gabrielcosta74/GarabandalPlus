-- Novena prayer sequence (configurable repetitions per novena / per day)
--
-- Adds an optional ordered prayer structure so a day can require, e.g.,
-- 1 Our Father, 10 Hail Marys, 1 Glory Be. When null everywhere, the prayer
-- mode falls back to the historical default (Our Father x1, Hail Mary x1, Glory Be x1).
--
-- JSON shape (ordered array):
--   [ { "type": "ourFather", "count": 1 },
--     { "type": "hailMary",  "count": 10 },
--     { "type": "gloryBe",   "count": 1 } ]
--   type: 'ourFather' | 'hailMary' | 'gloryBe'   (fixed PT/EN texts)
--   count: integer >= 1

-- Novena-level default sequence (applies to every day unless the day overrides it).
alter table novenas
  add column if not exists prayer_sequence jsonb;

-- Optional per-day override. Null = inherit the novena default.
alter table novena_days
  add column if not exists prayer_sequence jsonb;
