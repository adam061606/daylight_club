# Daylight Club — Midnight Collectibles
## Points Tracker Web App

---

## Project Structure

```
daylight-club/
├── index.html      ← Main app (leaderboard + admin tab)
├── styles.css      ← All styles
├── script.js       ← All app logic (ES module)
├── supabase.js     ← Supabase database layer
└── README.md       ← This file
```

---

## 1. Supabase Setup

### Create a free project
1. Go to https://app.supabase.com and create a new project
2. Go to **Settings → API** and copy:
   - **Project URL** → paste into `supabase.js` as `SUPABASE_URL`
   - **anon/public key** → paste into `supabase.js` as `SUPABASE_ANON_KEY`

### Create the two tables

Run this SQL in your Supabase **SQL Editor**:

```sql
-- Customers table
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  points integer not null default 0,
  created_at timestamptz default now()
);

-- Activity log table
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  customer_name text not null,
  action text not null,
  remark text,
  negative boolean default false,
  created_at timestamptz default now()
);

-- Allow public read on customers (for leaderboard)
alter table customers enable row level security;
create policy "Public read customers" on customers for select using (true);
create policy "Anon insert customers" on customers for insert with check (true);
create policy "Anon update customers" on customers for update using (true);
create policy "Anon delete customers" on customers for delete using (true);

-- Allow public read/write on activity_log
alter table activity_log enable row level security;
create policy "Public read activity" on activity_log for select using (true);
create policy "Anon insert activity" on activity_log for insert with check (true);
```

> **Note:** These policies are open for simplicity since the admin is password-protected at the app level. For production you can add proper Supabase auth.

---

## 2. Deploy to Vercel

1. Push the project folder to a GitHub repository
2. Go to https://vercel.com → **Add New Project** → import your repo
3. Framework preset: **Other** (static site)
4. Deploy — done!

No build step needed. Vercel serves the static files directly.

---

## 3. Admin Access

The admin tab is protected by the password: `M1dnightPo1nts`

To change the password, edit line in `script.js`:
```js
const ADMIN_PW = 'M1dnightPo1nts';
```

---

## Points System

| Rarity    | Points |
|-----------|--------|
| EX        | 1      |
| AR/SR     | 2      |
| IR/FA     | 3      |
| MA        | 5      |
| SAR/SIR   | 10     |
| MUR/BWR   | 20     |

**10 points = $1 voucher**
