# Frontend Integration Guide - Auto-Login

## ✅ What's Already Done

1. **AuthContext Enhanced** (`src/contexts/AuthContext.tsx`)
   - Added `session` state
   - Added `isAuthenticated` flag
   - Added `setSession()` method for auto-login
   - Added `signOut()` method

2. **Booking API Utilities** (`src/lib/booking-api.ts`)
   - `handleBookingWithAutoLogin()` - Main function to use
   - `createBooking()` - API call wrapper
   - `requireAuth()` - Helper for auth checks

---

## 📝 Integration Steps

### Step 1: Wrap App with AuthProvider

**File**: `src/app/layout.tsx` (or wherever your root layout is)

```typescript
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

### Step 2: Update Booking Form Component

**Find your booking form component** (likely in `src/app/peregrinacoes/[slug]/page.tsx` or similar)

**Add imports**:
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { handleBookingWithAutoLogin } from '@/lib/booking-api';
import { useRouter } from 'next/navigation';
```

**Use in component**:
```typescript
export default function BookingForm() {
  const { setSession, isAuthenticated } = useAuth();
  const router = useRouter();

  const onSubmit = async (formData) => {
    try {
      setLoading(true);

      // Create booking with auto-login
      const result = await handleBookingWithAutoLogin(formData, setSession);

      console.log('✅ Booking created:', result.booking_id);
      console.log('✅ User authenticated:', isAuthenticated);

      // Redirect to payment/success page
      // User is now authenticated and can upload receipts
      router.push(`/peregrinacoes/inscricao/${result.booking_id}`);

    } catch (error) {
      console.error('Booking error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Your form JSX
  );
}
```

---

### Step 3: Update Receipt Upload Component

**Find your receipt upload component**

**Add auth check**:
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { requireAuth } from '@/lib/booking-api';

export default function ReceiptUpload({ bookingId }: { bookingId: string }) {
  const { isAuthenticated, user } = useAuth();

  const handleUpload = async (file: File) => {
    try {
      // Check authentication before upload
      requireAuth(isAuthenticated);

      // Convert file to base64
      const base64 = await fileToBase64(file);

      // Upload receipt
      const response = await fetch('/api/payments/upload-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          fileData: base64,
          fileName: file.name,
          fileType: file.type,
          installmentLabel: 'Sinal de Inscrição',
          installmentAmount: 100, // Your amount
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const result = await response.json();
      console.log('✅ Receipt uploaded:', result.url);

    } catch (error) {
      if (error.message.includes('email')) {
        // Show user-friendly message
        alert('Por favor, aceda através do link no seu email para fazer upload.');
      } else {
        alert('Erro ao fazer upload: ' + error.message);
      }
    }
  };

  // Show auth status in UI
  if (!isAuthenticated) {
    return (
      <div className="auth-warning">
        <p>⚠️ Para fazer upload do comprovativo, aceda através do link no seu email.</p>
      </div>
    );
  }

  return (
    <div>
      <p>✅ Autenticado como: {user?.email}</p>
      {/* Your upload UI */}
    </div>
  );
}
```

---

### Step 4: Update Success/Payment Page

**File**: Your booking success or payment page

```typescript
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useSearchParams } from 'next/navigation';

export default function BookingSuccessPage() {
  const { isAuthenticated, session } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const bookingId = params.id;
  const viewToken = searchParams.get('token');

  useEffect(() => {
    const loadBooking = async () => {
      // Build URL with token if available
      const url = viewToken 
        ? `/api/booking/${bookingId}?token=${viewToken}`
        : `/api/booking/${bookingId}`;

      const response = await fetch(url);
      
      if (response.status === 401) {
        // Not authenticated and no valid token
        setError('Por favor, aceda através do link no seu email.');
        return;
      }

      const booking = await response.json();
      setBookingData(booking);
    };

    loadBooking();
  }, [bookingId, viewToken, isAuthenticated]);

  return (
    <div>
      {isAuthenticated ? (
        <>
          <h1>✅ Inscrição Confirmada</h1>
          <p>Autenticado como: {session?.user?.email}</p>
          {/* Show full booking details and upload form */}
        </>
      ) : viewToken ? (
        <>
          <h1>Inscrição Confirmada</h1>
          <p>⚠️ Para fazer upload de comprovativo, aceda através do link no email.</p>
          {/* Show limited booking details */}
        </>
      ) : (
        <>
          <h1>Acesso Negado</h1>
          <p>Por favor, verifique o seu email para aceder à sua inscrição.</p>
        </>
      )}
    </div>
  );
}
```

---

### Step 5: Handle 401/403 Errors Globally

**Create error handler** (`src/lib/api-error-handler.ts`):

```typescript
export function handleApiError(error: any, setSession?: (s: null) => void) {
  if (error.status === 401) {
    // Unauthorized - clear session
    if (setSession) setSession(null);
    return 'Sessão expirada. Por favor, aceda através do link no seu email.';
  }
  
  if (error.status === 403) {
    return 'Não tem permissão para aceder a este recurso.';
  }
  
  return error.message || 'Erro desconhecido';
}
```

---

## 🧪 Testing Checklist

### Test New User Flow
1. [ ] Fill booking form with new email
2. [ ] Submit form
3. [ ] Check console: "Session created for new user auto-login"
4. [ ] Check console: "User is now authenticated"
5. [ ] Redirect to payment page
6. [ ] Upload receipt → Should succeed immediately
7. [ ] Check localStorage: Should have `sb-*-auth-token`

### Test Existing User Flow
1. [ ] Fill booking form with existing email
2. [ ] Submit form
3. [ ] Check console: "No session returned (existing user)"
4. [ ] If user is already logged in → Can upload
5. [ ] If user is NOT logged in → Must use magic link

### Test Session Persistence
1. [ ] Create booking (get auto-logged in)
2. [ ] Refresh page
3. [ ] Check: Still authenticated
4. [ ] Can still upload receipts

### Test Error Handling
1. [ ] Try to upload receipt without auth → Should show error
2. [ ] Try to access booking without auth/token → Should show error
3. [ ] Session expires → Should prompt to check email

---

## 🎯 Key Points

1. **New users** get auto-logged in immediately after booking
2. **Existing users** need to use their existing session or magic link
3. **Session persists** across page refreshes (localStorage)
4. **Receipt upload** requires authentication
5. **Magic link** still works as backup access method

---

## 🚀 Next Steps

1. Integrate into your booking form component
2. Update receipt upload component with auth check
3. Update success/payment page to handle auth states
4. Test the complete flow
5. Deploy and verify in production

All backend changes are already deployed and working!
