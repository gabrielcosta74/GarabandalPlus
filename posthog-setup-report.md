<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into this Next.js (App Router) project. The project already had a client-side PostHog setup (`src/lib/analytics.ts`) with store events tracked. This integration added server-side tracking for critical business operations, user identification, new client-side events, and a PostHog dashboard with insights.

## Summary of changes

- **`src/lib/posthog-server.ts`** _(new file)_: Server-side PostHog client using `posthog-node`, initialized from environment variables.
- **`src/contexts/AuthContext.tsx`**: Added `posthog.identify()` on session sync so authenticated users are linked across events. Added `posthog.reset()` on sign-out.
- **`src/components/pilgrimage/BrochureDownloadModal.tsx`**: Captures `brochure_requested` when the brochure form is successfully submitted.
- **`src/app/api/booking/create/route.ts`**: Captures `booking_created` server-side after a pilgrimage booking is atomically committed.
- **`src/app/api/store/checkout/route.ts`**: Captures `store_checkout_initiated` server-side after the order is created and payment gateway is launched.
- **`src/app/api/leads/capture/route.ts`**: Captures `lead_captured` server-side after a lead (brochure request or waitlist) is saved.
- **`.env.local`**: Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` environment variables.
- **`package.json` / `node_modules`**: Installed `posthog-node` (v5.21.2) for server-side tracking.

## Events

| Event | Description | File |
|---|---|---|
| `brochure_requested` | User submits brochure/itinerary request form for a pilgrimage | `src/components/pilgrimage/BrochureDownloadModal.tsx` |
| `booking_created` | Server-side: Pilgrimage booking successfully created in database | `src/app/api/booking/create/route.ts` |
| `store_checkout_initiated` | Server-side: Store checkout order created and payment gateway initiated | `src/app/api/store/checkout/route.ts` |
| `lead_captured` | Server-side: Lead (brochure request, waitlist) captured in database | `src/app/api/leads/capture/route.ts` |
| `store_product_viewed` | User views a product detail page _(pre-existing)_ | `src/app/loja/[id]/ProductDetailsClient.tsx` |
| `store_add_to_cart` | User adds a product to the cart _(pre-existing)_ | `src/app/loja/[id]/ProductDetailsClient.tsx` |
| `store_category_selected` | User filters store by category _(pre-existing)_ | `src/app/loja/StorePageClient.tsx` |
| `store_product_clicked` | User clicks a product card in the store listing _(pre-existing)_ | `src/app/loja/StorePageClient.tsx` |
| `store_payment_returned` | User lands on thank-you page after store payment attempt _(pre-existing)_ | `src/app/thank-you/page.tsx` |
| `store_purchase_completed` | Store purchase confirmed (Stripe or Reduniq) _(pre-existing)_ | `src/app/thank-you/page.tsx` |
| `store_purchase_failed` | Store purchase failed or was cancelled _(pre-existing)_ | `src/app/thank-you/page.tsx` |
| `$pageview` | Automatic pageview on route change (public paths only) _(pre-existing)_ | `src/components/analytics/PublicAnalytics.tsx` |

## Next steps

We've built a dashboard and insights to monitor user behavior based on the instrumented events:

- **Dashboard**: [Analytics basics](https://us.posthog.com/project/397178/dashboard/1509994)
- **Store Purchase Funnel** (product view → cart → checkout → purchase): [View insight](https://us.posthog.com/project/397178/insights/AG4T9yx9)
- **Pilgrimage Booking Funnel** (brochure request → booking created): [View insight](https://us.posthog.com/project/397178/insights/haylY3V5)
- **Bookings & Purchases Over Time** (daily trend): [View insight](https://us.posthog.com/project/397178/insights/dh2zkJfM)
- **Lead Capture Trend** (leads and brochures daily): [View insight](https://us.posthog.com/project/397178/insights/WVuM11Bk)
- **Store Payment Outcomes** (completed vs failed): [View insight](https://us.posthog.com/project/397178/insights/7sCpzKor)

### Agent skill

The wizard offered to install local agent skills, but they were removed at the end of the setup.

</wizard-report>
