curl -X POST https://pagamentos.sandbox.reduniq.pt/api-gateway/v7.0/rest/ \
  -H "Content-Type: application/json" \
  -d '{
    "method": "initPayment",
    "api": {
      "username": "3205693",
      "password": "56ff#H8-2R2fSRiM:g.$"
    },
    "payment": {
      "amount": 100,
      "action": 100,
      "description": "Teste de ligacao API"
    },
    "order": {
      "ref": "TEST_API_001",
      "amount": 100,
      "date": "2026-01-27 12:00:00"
    },
    "returnUrlOk": "https://example.com/ok",
    "returnUrlError": "https://example.com/error",
    "languageCode": "por"
  }'
