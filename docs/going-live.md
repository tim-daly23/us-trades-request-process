# Going live

Two jobs: a production database separate from dev, and a real domain. Neither
needs a code change — the app reads whichever Supabase project its environment
variables point at.

---

## 1. Production database

Dev currently holds test data, deleted-customer leftovers, and accounts created
while things were half-configured. Customer orders should not land next to that,
and you want somewhere to be wrong that is not the live system.

### Create it

1. supabase.com/dashboard → **New project**
2. Name `ustrades-portal-prod`
3. **Region: East US (North Virginia)** — must match dev, and cannot be changed later
4. Generate the database password and save it to your password manager
5. Plan: **Pro** before real customer data. The free tier pauses after ~7 days
   idle and has no point-in-time recovery, neither of which is acceptable for
   worker PII under a customer contract.

### Apply the schema

Open the SQL Editor and run `scripts/production-setup.sql` in one paste. It is
every migration plus the craft/level/credential catalogue, in order.

That file is generated — after adding a migration, rebuild it rather than
appending by hand:

```bash
node scripts/make-production-setup.js
```

Then verify, in this order:

- `scripts/verify_schema.sql` — expect every row OK
- `scripts/test_rls.sql` — the three-scenario tenant isolation test

Do not skip the second one. It is the only thing that proves one customer
cannot read another's data on *this* database.

### Enable the access token hook

**Authentication → Hooks → Customize Access Token (JWT) Claims.** Enable,
choose Postgres, select `public.custom_access_token_hook`, save.

Without it every policy evaluates against a null `user_type` and every screen
shows zero rows while looking perfectly healthy.

### Create the first agency login

Chicken-and-egg: the console creates logins, but you need a login to reach the
console.

1. **Authentication → Users → Add user**, with **Auto Confirm User** ticked
2. Copy the new user's id
3. Run the `insert into app_users` template at the end of
   `scripts/production-setup.sql`

Everything after that — customers, sites, portal logins — goes through the
console.

That first account must be `super_admin`. It is the only role that reaches
every customer and the only one that can open **Team**, where the rest of the
staff are created and given their customers.

### Adding the rest of the team

**Agency console → Team.** Create the login, then tick the customers that
person works on. They see those and nothing else — the scoping is in the
database (`can_access_customer`), so it holds on every screen and on the REST
API, not just the ones that remember to filter.

A role change travels in the access token, so it applies at their next
sign-in. Ticking or unticking a customer applies immediately.

### Point production at it

In Vercel → Settings → Environment Variables, edit the **Production** values
only, leaving Preview pointed at dev:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the new project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the new project's anon key (Config) |
| `SUPABASE_SERVICE_ROLE_KEY` | the new project's service_role key (Secret) |

Redeploy with **"Use existing Build Cache" unticked** — `NEXT_PUBLIC_*` values
are compiled in at build time, so a cached build keeps the old ones.

That split is worth keeping: preview deployments then run against dev, so a
branch cannot touch live data.

---

## 2. Custom domain

### In Vercel

Project → **Settings → Domains** → **Add**. Enter `portal.ustrades.com`.

Vercel shows the DNS record to create — normally:

```
Type   CNAME
Name   portal
Value  cname.vercel-dns.com
```

### In your DNS

Wherever `ustrades.com` is managed, add that record. Propagation is usually
minutes; Vercel issues the TLS certificate automatically once it resolves.

### Afterwards

Vercel keeps serving `us-trades-request-process.vercel.app` as well. Send
customers the real domain — it is the one that survives a project rename.

---

## Per-customer subdomains

The schema anticipates `acme.portal.ustrades.com` per tenant: `customers.slug`
and the `custom_domains` table with verification tokens and SSL timestamps.

Nothing is built for it yet, and nothing needs to be — one domain works for
every customer, since sign-in already scopes them to their own tenant. Worth
doing when a customer asks for their own address, not before.

Note that wildcard domains (`*.portal.ustrades.com`) need a paid Vercel plan.
Confirm that before promising a customer their own subdomain.
