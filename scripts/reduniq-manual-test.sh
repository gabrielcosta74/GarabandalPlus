#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "== Reduniq manual smoke test =="
echo "BASE_URL=$BASE_URL"
echo

echo "-- 1) Test gateway reachability (server -> Reduniq) --"
curl -sS "$BASE_URL/api/test-reduniq" | python3 -m json.tool
echo

echo "-- 2) Create a Reduniq donation checkout (returns redirect URL + orderRef) --"
RESP="$(
  curl -sS -X POST "$BASE_URL/api/checkout" \
    -H 'Content-Type: application/json' \
    -d '{
      "amount": 10,
      "type": "donation",
      "provider": "reduniq",
      "donorName": "Teste Reduniq",
      "donorEmail": "teste@example.com",
      "donorCountry": "PT",
      "receiptRequired": false
    }'
)"
echo "$RESP" | python3 -m json.tool

ORDER_REF="$(python3 - <<'PY'
import json,sys
data=json.load(sys.stdin)
print(data.get("orderRef",""))
PY <<<"$RESP")"

REDIRECT_URL="$(python3 - <<'PY'
import json,sys
data=json.load(sys.stdin)
print(data.get("url",""))
PY <<<"$RESP")"

echo
echo "orderRef=$ORDER_REF"
echo "redirectUrl=$REDIRECT_URL"
echo
echo "Open the redirectUrl in a browser and complete the payment."
echo

echo "-- 3) Check status (debug) --"
curl -sS "$BASE_URL/api/reduniq/result?orderRef=$ORDER_REF" | python3 -m json.tool
echo

echo "-- 4) Confirm + update DB (idempotent) --"
curl -sS -X POST "$BASE_URL/api/reduniq/confirm" \
  -H 'Content-Type: application/json' \
  -d "{\"orderRef\":\"$ORDER_REF\"}" | python3 -m json.tool
echo

cat <<'TXT'
-- Admin operations (capture/refund/void/search) --
These endpoints require:
  env REDUNIQ_ADMIN_SECRET (server-side)
  header Authorization: Bearer <REDUNIQ_ADMIN_SECRET>

Examples:
  curl -X POST $BASE_URL/api/reduniq/search -H "Authorization: Bearer $REDUNIQ_ADMIN_SECRET" -H "Content-Type: application/json" -d '{"status":4,"limit":10}'
  curl -X POST $BASE_URL/api/reduniq/capture -H "Authorization: Bearer $REDUNIQ_ADMIN_SECRET" -H "Content-Type: application/json" -d '{"transactionId":"...","amountCents":700,"action":200}'
  curl -X POST $BASE_URL/api/reduniq/refund -H "Authorization: Bearer $REDUNIQ_ADMIN_SECRET" -H "Content-Type: application/json" -d '{"transactionId":"...","amountCents":700}'
  curl -X POST $BASE_URL/api/reduniq/void -H "Authorization: Bearer $REDUNIQ_ADMIN_SECRET" -H "Content-Type: application/json" -d '{"transactionId":"..."}'
TXT

