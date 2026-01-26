# Email System Documentation

This document outlines all the automated emails sent by the application, their triggers, and the templates used.

**Source of Truth**: `src/lib/email.ts`

## Membership & Quotas

| Email Name | Trigger | Recipient | Function | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Membership Welcome** | Payment Succeeded (Stripe Webhook) | Member | `sendMembershipNotification` | Sent when a new membership payment is confirmed via Stripe. |
| **Member Receipt** | Payment Succeeded (Stripe Webhook) | Member | `sendMemberReceiptEmail` | Payment confirmation sent for both new memberships and renewals. |
| **Member Diploma** | Payment Succeeded (New Member) | Member | `sendMemberDiplomaEmail` | Sent as an attachment with the receipt for new members. |
| **Quota Reminder** | Cron Job (Daily) | Member | `sendQuotaReminderEmail` | Sent at: **30 days before**, **7 days before**, **1 day before** due date. Also sent when **Overdue** by 7, 14, and 30 days. |

## Online Store

| Email Name | Trigger | Recipient | Function | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Order Confirmation** | Checkout Complete (Stripe Webhook) | Buyer | `sendStoreBuyerEmail` | Sent immediately after successful payment. Includes digital links and Biblioteca CTA when there are digital items; for physical-only orders, highlights tracking/area access. |
| **New Order Alert** | Checkout Complete (Stripe Webhook) | Admin | `sendStoreOwnerEmail` | Notification to store owner with order details and shipping info. |
| **Order Preparing** | Checkout Complete (Physical Items) | Buyer | `sendStorePreparingEmail` | Sent automatically for orders containing physical items immediately after payment. |
| **Order Shipped** | Manual Admin Action | Buyer | `sendStoreShippingEmail` | Sent when admin adds tracking code and marks as shipped. |

## Leads & Engagement

| Email Name | Trigger | Recipient | Function | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Waitlist Confirmation** | Lead Capture Form Submission | User | `sendGeneralLeadEmail` | Confirms entry into waiting list when no pilgrimage date is selected. |
| **Abandonment Recovery** | Cron Job (Every ~15m) | User | `sendAbandonmentRecoveryEmail` | Sent if registration is started but not completed (Status 'draft') after **30 minutes**. |

## Donations & Fiscal

| Email Name | Trigger | Recipient | Function | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Donation Receipt** | Donation Success (Stripe Webhook) | Donor | `sendDonationReceiptEmail` | Thank you message sent immediately after donation payment. |
| **Invoice (Client)** | Invoice Generated | User | `renderFactPtClientEmail` | Sends the certified invoice PDF (Fact.pt integration). |
| **Invoice (Admin)** | Invoice Generated | Admin | `renderFactPtAdminEmail` | Copy of the generated invoice for accounting. |

## Technical Details

- **Provider**: [Resend](https://resend.com)
- **Base Components**: All emails use `renderEmailShell` for consistent branding (Logo, Header, Footer).
- **Styles**: Inline CSS is used for maximum compatibility across email clients.
