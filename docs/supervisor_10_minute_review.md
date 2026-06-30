# Supervisor 10-Minute Review Checklist

Use this script to evaluate project progress quickly and consistently.

## Minute 0-2: Runtime Proof

1. Backend health:
   - Open `http://localhost:5000/api/health`
   - Expect `status: "healthy"` and `database: "connected"`
2. Frontend accessibility:
   - Open `http://localhost:3000`
   - Confirm homepage loads without runtime errors

## Minute 2-5: Core User Flow

1. Register resident account
2. Verify email via OTP page
3. Login as resident with ward selection
4. Submit a report and confirm tracking number appears

## Minute 5-8: Role Flow

1. Login as authority user
2. Open officer dashboard (`/officer`)
3. Load assigned reports and perform one status update
4. Login as admin user
5. Open admin panel (`/admin`) and refresh datasets
6. Open analytics dashboard (`/analytics`) and load summaries

## Minute 8-10: Engineering Quality Proof

1. Run frontend quality gate:
   - `cd client`
   - `npm run check`
2. Confirm lint passes and production build succeeds
3. Check that role-aware navigation updates after login/logout

## Marking Rubric Snapshot

- Functional correctness: server + key flows all work
- Security/authorization: token + role checks enforced
- UX quality: loading, success, and error states visible
- Code quality: lint/build clean
- Delivery maturity: clear runbook and repeatable verification
