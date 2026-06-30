# Client App (Next.js)

Frontend for the IS PROJECT platform.

## Run

```bash
npm install
npm run dev
```

Local app URL: `http://localhost:3000`

## Quality Gate

```bash
npm run check
```

Runs:
- ESLint (`npm run lint`)
- Production build (`npm run build`)

## Role Pages

- Resident home: `/`
- Resident profile: `/my-profile`
- Public reports: `/reports`
- Officer dashboard: `/officer`
- Admin panel: `/admin`
- Analytics dashboard: `/analytics`

## Auth + Role Behavior

- Login supports role context: resident, authority, admin
- Resident login validates ward selection
- OTP verification is required before access for unverified users
- Post-login redirect uses role-aware routing

## Media and Maps

- Report/profile media is served from backend uploads (`http://localhost:5000/uploads/...`)
- Leaflet map styles are imported in app layout
