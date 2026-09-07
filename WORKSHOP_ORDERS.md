# Workshop orders inbox

“Send to shop” now submits directly to **Admin → Orders inbox**. The customer confirms their contact details once, waits for the files to finish saving, and receives an on-screen reference. Gmail authorization, an email provider, and a custom domain are not required. No email is sent.

The inbox shows customer details, design name, reference and submission date. Admins can download the printable PDF and original image, filter/paginate orders, and explicitly set New, Viewed, In progress or Completed. Opening an order does not change its status automatically. Refresh loads new submissions.

## Deployment

Apply `supabase/migrations/006_workshop_orders.sql` before deploying the new UI. It adds the service-role-only `shop_orders` table and private `workshop-orders` bucket. It does not migrate Gmail drafts into submitted orders or delete previous Gmail settings/files.

This migration has been applied to the current project database. Anonymous and authenticated client roles have no direct table access, and the storage bucket is private.

## Submission and storage

- A handover is identified by the authenticated user, original saved image ID and brief reference. Repeated clicks/retries for that handover reuse one record. A different image or reference can create a new order.
- `preparing` records are excluded from the admin inbox. The API only marks an order New after the PDF and original image are stored and the PDF passes format/size checks.
- Contact details are captured on the first preparation attempt. The uploaded PDF uses that same snapshot, including when resuming an interrupted upload. Submitted records and files cannot be changed by customers.
- The original image is copied into an immutable PNG object. It is never replaced by the app-watermarked display image. Images predating original preservation may be unavailable for submission.
- PDFs use scoped, non-overwriting upload tokens. There are no regular client policies for reading/writing the bucket. Admin download URLs expire after five minutes; the open detail view renews them and offers Refresh files.
- Admin status changes check the previous status to avoid overwriting a concurrent update. Customer retries do not reset the shop's status.
- Incomplete preparations remain private and can resume; automatic cleanup is not currently scheduled.

## Validation

Run `node scripts/test-workshop-orders.cjs`, `npx tsc --noEmit --incremental false`, and `npm run build`. Tests cover ownership, admin authorization, original-image recovery, immutable copies, duplicate submission, missing/invalid files, status conflicts, and browser upload failure/retry. The earlier Gmail route is retained for compatibility with existing clients; it is no longer used by the current interface.
