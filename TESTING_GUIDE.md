# 🧪 Auto-Login Testing Guide

## Test Setup
- **Test Email**: `gabrielsanticosta@gmail.com`
- **Status**: All data deleted, ready for fresh testing
- **Dev Server**: http://localhost:3000

---

## Test 1: New User Auto-Login ⭐ (Primary Test)

**Objective**: Verify new users are automatically logged in after booking

### Steps:
1. Open **incognito/private window**
2. Navigate to: http://localhost:3000/peregrinacoes/peregrinacao-iberica-2026
3. Click "Inscrever" button
4. Fill form with:
   - Email: `gabrielsanticosta@gmail.com`
   - Phone: Any valid number
5. Complete all booking steps (pilgrims, rooms, payment)
6. Submit booking

### Expected Results:
✅ **Console should show**:
```
✅ [Booking] Auto-login session received, setting session...
✅ [Booking] User is now authenticated
✅ [Auth] Session set successfully
```

✅ **localStorage should contain**:
- Key: `sb-pntzzuxzjnzksubbjfvj-auth-token`
- Value: JSON with `access_token` and `refresh_token`

✅ **Redirect**: Should go to `/peregrinacoes/inscricao/[booking-id]?success=true`

✅ **Receipt Upload**: Should be able to upload receipt immediately (no email check needed)

### How to Check:
- Open DevTools (F12 or Cmd+Option+I)
- Go to Console tab → Check for success messages
- Go to Application tab → Storage → Local Storage → Check for auth token
- Try uploading a receipt → Should work without errors

---

## Test 2: Session Persistence

**Objective**: Verify session persists across page refreshes

### Steps:
1. After Test 1, **refresh the page** (F5)
2. Check console and localStorage again

### Expected Results:
✅ Session still in localStorage
✅ User still authenticated
✅ Can still upload receipts
✅ No need to check email

---

## Test 3: Receipt Upload Authentication

**Objective**: Verify receipt upload requires authentication

### Steps:
1. Open **new incognito window**
2. Get booking ID from Test 1 URL (e.g., `abc123-def456`)
3. Navigate directly to: `http://localhost:3000/peregrinacoes/inscricao/[booking-id]`
4. Try to upload a receipt

### Expected Results:
✅ Alert: "Por favor, aceda através do link no seu email para fazer upload do comprovativo."
✅ Upload should NOT work
✅ Console shows authentication check

---

## Test 4: Existing User (Second Booking)

**Objective**: Verify existing users don't get duplicate sessions

### Steps:
1. After Test 1, create ANOTHER booking with same email
2. Use same email: `gabrielsanticosta@gmail.com`
3. Submit booking

### Expected Results:
✅ Console shows: `session: null` (existing user)
✅ No new session created
✅ Uses existing session from Test 1
✅ Can still upload receipts (already authenticated)

---

## Test 5: Error Handling - Expired Session

**Objective**: Verify proper error handling for expired sessions

### Steps:
1. After Test 1, open DevTools
2. Go to Application → Local Storage
3. **Delete** the `sb-*-auth-token` key
4. Try to upload a receipt

### Expected Results:
✅ Alert: "Sessão expirada. Por favor, aceda através do link no seu email."
✅ Upload should fail gracefully
✅ No console errors

---

## Test 6: Multiple Pilgrims Booking

**Objective**: Verify auto-login works with complex bookings

### Steps:
1. Open incognito window
2. Create booking with **3+ pilgrims**
3. Assign different room types
4. Submit

### Expected Results:
✅ Auto-login still works
✅ All pilgrim data saved correctly
✅ Can upload receipt immediately

---

## Test 7: Payment Flow Integration

**Objective**: Verify auto-login works with Stripe payment

### Steps:
1. Create booking (Test 1)
2. On payment page, click "Pagar Online"
3. Complete Stripe checkout (use test card: `4242 4242 4242 4242`)
4. Return to booking page

### Expected Results:
✅ Still authenticated after Stripe redirect
✅ Session persists
✅ Payment status updated

---

## Quick Verification Checklist

After each test, verify:
- [ ] No console errors
- [ ] Session in localStorage
- [ ] User can upload receipts
- [ ] Page loads without infinite spinner
- [ ] No webpack errors

---

## Common Issues & Solutions

### Issue: "Cannot read properties of undefined"
**Solution**: Check AuthContext is wrapped properly in ClientLayout

### Issue: Infinite loading spinner
**Solution**: Check console for errors, verify Supabase connection

### Issue: "Por favor, aceda através do link"
**Solution**: Session not created - check backend logs for session generation

### Issue: 401/403 on receipt upload
**Solution**: Session expired or not authenticated - verify localStorage has token

---

## Success Criteria

✅ **Test 1 MUST pass** - This is the core auto-login feature  
✅ **Test 2 MUST pass** - Session persistence is critical  
✅ **Test 3 MUST pass** - Security requirement  
✅ Tests 4-7 are nice-to-have but recommended  

---

## Cleanup After Testing

To reset for another test:
1. Clear browser localStorage
2. Use incognito window
3. Or delete user via Supabase dashboard

---

## Report Format

When reporting results:
```
Test 1: ✅ PASS / ❌ FAIL
- Console output: [paste here]
- localStorage: [screenshot or paste]
- Issues: [describe any problems]

Test 2: ✅ PASS / ❌ FAIL
...
```

---

**Ready to test!** Start with Test 1 - that's the most important one! 🚀
