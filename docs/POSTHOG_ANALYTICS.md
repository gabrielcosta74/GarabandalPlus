# PostHog web analytics: what the numbers mean

## Scope

PostHog records public site activity only after the visitor accepts analytics cookies. Do Not Track and browsers that block the SDK are excluded. Admin browsers, admin previews, private booking pages, and check-in pages are excluded from public web analytics. These are **consented public-site metrics**, not a count of every request to the website. Do not compare their visitor totals directly with the site's separate first-party tracker, which has a different consent and identity model.

The Web analytics dashboard applies every active country, path, device, and date filter to its headline totals. Check the filter count before reporting a sitewide total, and enable **Filter test accounts** when reporting public traffic. Compare complete date ranges when interpreting trends; the current day is partial. Use P75 for Core Web Vitals reporting.

## Pilgrimage reporting

- `$pageview` records each public pilgrimage detail or registration-form view. `site_area = pilgrimage`, `pilgrimage_slug`, and `pilgrimage_page = detail | registration` allow filtering and grouping across Portuguese and English routes.
- `pilgrimage_viewed` means the pilgrimage detail data actually loaded. It is a stricter measure than a pageview, which can include a page that did not finish loading.
- `pilgrimage_cta_clicked` and `pilgrimage_waitlist_clicked` record the main public calls to action, with `placement`.
- `registration_step_viewed` records a form step once per step change; `registration_submitted` records an attempted submission; `registration_submit_failed` records a request failure.
- `booking_created` is emitted by the server after the booking is committed. It is the successful conversion event and carries `pilgrimage_id` and `pilgrimage_slug`. It should not be confused with `registration_submitted`.

Use `pilgrimage_slug` to compare the same pilgrimage in both languages. For public page performance, filter `$web_vitals` by the page path and use P75. The separate booking detail route `/peregrinacoes/inscricao/[id]` is private and is intentionally absent from public reports.

## Data cutover and verification

Before the proxy fix is deployed, GeoIP is based on the proxy server's IP and historical Netherlands figures are unreliable. The original visitor IP was not retained in those events, so a code deployment cannot repair their country retrospectively. For geographic comparisons, start the date range **after deployment**.

After deployment, verify with consented visits from two known countries that new `$pageview` events have different `$geoip_country_code` values, while `/maria-sinais` ingestion still succeeds. Also verify that a public pilgrimage detail view, a CTA click, registration step 1, and a successful booking produce the events above with the same slug and session. Check that an admin preview and a private booking URL create no public `$pageview`.
