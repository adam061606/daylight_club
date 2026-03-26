// ─────────────────────────────────────────────
//  supabase.js  —  Database layer
//
//  Replace SUPABASE_URL and SUPABASE_ANON_KEY
//  with your project values from:
//  https://app.supabase.com → Settings → API
// ─────────────────────────────────────────────

const SUPABASE_URL = 'https://ikhtwmboeehbtjmqackp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlraHR3bWJvZWVoYnRqbXFhY2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDQwODEsImV4cCI6MjA5MDAyMDA4MX0.g_Fx3nRB8UqBIzQ2woWgdN9N8EDP5fsanvZ7nR5A4nw';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Prefer': 'return=representation',
};

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} — ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ── CUSTOMERS ──────────────────────────────────
export async function getCustomers() {
  return sbFetch('customers?select=*&order=points.desc');
}

export async function createCustomer(name) {
  return sbFetch('customers', {
    method: 'POST',
    body: JSON.stringify({ name, points: 0 }),
  });
}

export async function deleteCustomer(id) {
  return sbFetch(`customers?id=eq.${id}`, { method: 'DELETE' });
}

export async function updateCustomerPoints(id, points) {
  return sbFetch(`customers?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ points }),
  });
}

// ── ACTIVITY LOG ───────────────────────────────
export async function getHistory() {
  return sbFetch('activity_log?select=*&order=created_at.desc&limit=50');
}

export async function logActivity({ customer_id, customer_name, action, remark, negative }) {
  return sbFetch('activity_log', {
    method: 'POST',
    body: JSON.stringify({ customer_id, customer_name, action, remark: remark || null, negative: !!negative }),
  });
}
