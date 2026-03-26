import {
  getCustomers, createCustomer, deleteCustomer,
  updateCustomerPoints, getHistory, logActivity
} from './supabase.js';

// ── STATE ────────────────────────────────────
let customers = [];
let history   = [];
let selectedRarities  = [];
let showAllLeaderboard = false;
let adminUnlocked = false;

const ADMIN_PW = 'M1dnightPo1nts';

const RARITY_COLORS = {
  'EX': 'var(--ex)', 'AR/SR': 'var(--arsr)', 'IR/FA': 'var(--irfa)',
  'MA': 'var(--ma)', 'SAR/SIR': 'var(--sarsr)', 'MUR/BWR': 'var(--mur)'
};

// ── BOOT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  hideLoading();
  render();
});

async function loadAll() {
  try {
    [customers, history] = await Promise.all([getCustomers(), getHistory()]);
  } catch (e) {
    console.error('Failed to load data:', e);
    showToast('Could not connect to database', true);
  }
}

function hideLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) { el.classList.add('hidden'); setTimeout(() => el.remove(), 500); }
}

// ── TAB SWITCHING ────────────────────────────
window.switchTab = function(tabName, el) {
  if (tabName === 'admin' && !adminUnlocked) {
    showPasswordOverlay();
    return;
  }
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('page-' + tabName).classList.add('active');
  if (tabName === 'leaderboard') renderLeaderboard();
};

// ── PASSWORD ─────────────────────────────────
window.showPasswordOverlay = function() {
  document.getElementById('pwOverlay').classList.add('show');
  document.getElementById('pwInput').value = '';
  document.getElementById('pwError').textContent = '';
  setTimeout(() => document.getElementById('pwInput').focus(), 100);
};

window.closePasswordOverlay = function() {
  document.getElementById('pwOverlay').classList.remove('show');
};

window.checkPassword = function() {
  const val = document.getElementById('pwInput').value;
  if (val === ADMIN_PW) {
    adminUnlocked = true;
    closePasswordOverlay();
    // Switch to admin tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="admin"]').classList.add('active');
    document.getElementById('page-admin').classList.add('active');
  } else {
    const inp = document.getElementById('pwInput');
    inp.classList.add('error');
    document.getElementById('pwError').textContent = 'Incorrect password. Try again.';
    setTimeout(() => inp.classList.remove('error'), 400);
  }
};

window.togglePwVisibility = function() {
  const inp = document.getElementById('pwInput');
  const btn = document.getElementById('pwToggle');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
};

// ── RARITY SELECTION ─────────────────────────
window.toggleRarity = function(btn) {
  const rarity = btn.dataset.rarity;
  const pts = parseInt(btn.dataset.pts);
  const idx = selectedRarities.findIndex(r => r.rarity === rarity);
  if (idx >= 0) {
    selectedRarities.splice(idx, 1);
    btn.classList.remove('selected');
  } else {
    selectedRarities.push({ rarity, pts, qty: 1 });
    btn.classList.add('selected');
  }
  renderSelectedRarities();
  updatePreview();
};

window.changeRarityQty = function(i, delta) {
  selectedRarities[i].qty = Math.max(1, selectedRarities[i].qty + delta);
  renderSelectedRarities();
  updatePreview();
};

window.setRarityQty = function(i, val) {
  selectedRarities[i].qty = Math.max(1, parseInt(val) || 1);
  updatePreview();
  const rows = document.querySelectorAll('.rarity-row');
  if (rows[i]) rows[i].querySelector('.rarity-row-subtotal').textContent =
    selectedRarities[i].pts * selectedRarities[i].qty + ' pts';
};

window.removeRarity = function(rarity) {
  selectedRarities = selectedRarities.filter(r => r.rarity !== rarity);
  document.querySelectorAll('.rarity-btn').forEach(b => {
    if (b.dataset.rarity === rarity) b.classList.remove('selected');
  });
  renderSelectedRarities();
  updatePreview();
};

function renderSelectedRarities() {
  const container = document.getElementById('selectedRarities');
  if (!selectedRarities.length) { container.innerHTML = ''; return; }
  container.innerHTML = selectedRarities.map((r, i) => `
    <div class="rarity-row">
      <div class="rarity-row-label" style="color:${RARITY_COLORS[r.rarity]}">${r.rarity}</div>
      <div class="rarity-row-pts">${r.pts} pt${r.pts > 1 ? 's' : ''} each</div>
      <div class="qty-inline">
        <button class="qib" onclick="changeRarityQty(${i},-1)">−</button>
        <input class="qiv" type="number" value="${r.qty}" min="1" max="99" oninput="setRarityQty(${i},this.value)">
        <button class="qib" onclick="changeRarityQty(${i},1)">+</button>
      </div>
      <div class="rarity-row-subtotal">${r.pts * r.qty} pts</div>
      <button class="rarity-row-remove" onclick="removeRarity('${r.rarity}')">✕</button>
    </div>`).join('');
}

function updatePreview() {
  const total = selectedRarities.reduce((s, r) => s + r.pts * r.qty, 0);
  document.getElementById('previewPts').textContent = total > 0 ? total + ' pts' : '—';
  document.getElementById('previewRarity').textContent = selectedRarities.length
    ? selectedRarities.map(r => r.qty + '× ' + r.rarity).join(', ')
    : 'None';
}

// ── REDEEM QTY ───────────────────────────────
window.changeRedeemQty = function(delta) {
  const inp = document.getElementById('redeemQty');
  inp.value = Math.max(1, (parseInt(inp.value) || 1) + delta);
  document.getElementById('redeemAmt').textContent = parseInt(inp.value) || 1;
};

// ── CUSTOMERS ────────────────────────────────
window.addCustomer = async function() {
  const nameEl = document.getElementById('newCustomerName');
  const name = nameEl.value.trim();
  if (!name) return showToast('Enter a customer name', true);
  if (customers.find(c => c.name.toLowerCase() === name.toLowerCase()))
    return showToast('Customer already exists', true);

  try {
    const [newCust] = await createCustomer(name);
    customers.push(newCust);
    nameEl.value = '';
    render();
    showToast(`Customer "${name}" added!`);
  } catch (e) {
    showToast('Failed to add customer', true);
  }
};

window.removeCustomer = async function(id) {
  if (!confirm('Remove this customer?')) return;
  try {
    await deleteCustomer(id);
    customers = customers.filter(c => c.id !== id);
    render();
  } catch (e) {
    showToast('Failed to remove customer', true);
  }
};

// ── ADD POINTS ───────────────────────────────
window.addPoints = async function() {
  const custId = document.getElementById('selectCustomer').value;
  const remarks = document.getElementById('remarksInput').value.trim();
  if (!custId) return showToast('Select a customer', true);
  if (!selectedRarities.length) return showToast('Select at least one rarity', true);

  const c = customers.find(x => x.id === custId);
  const total = selectedRarities.reduce((s, r) => s + r.pts * r.qty, 0);
  const newPoints = c.points + total;
  const breakdown = selectedRarities.map(r => r.qty + '× ' + r.rarity).join(', ');

  const btn = document.querySelector('#page-admin .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await updateCustomerPoints(custId, newPoints);
    await logActivity({
      customer_id: custId,
      customer_name: c.name,
      action: `+${total} pts (${breakdown})`,
      remark: remarks || null,
      negative: false,
    });

    c.points = newPoints;
    const logEntry = {
      created_at: new Date().toISOString(),
      customer_name: c.name,
      action: `+${total} pts (${breakdown})`,
      remark: remarks || null,
      negative: false,
    };
    history.unshift(logEntry);

    // Reset form
    selectedRarities = [];
    document.querySelectorAll('.rarity-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('remarksInput').value = '';
    renderSelectedRarities();
    updatePreview();

    render();
    showToast(`+${total} pts added to ${c.name}`);
  } catch (e) {
    showToast('Failed to save points', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add Points';
  }
};

// ── REDEEM VOUCHER ───────────────────────────
window.redeemVoucher = async function() {
  const custId = document.getElementById('redeemCustomer').value;
  const qty = parseInt(document.getElementById('redeemQty').value) || 1;
  const cost = qty * 10;
  if (!custId) return showToast('Select a customer', true);

  const c = customers.find(x => x.id === custId);
  if (c.points < cost) return showToast(`Not enough points! Need ${cost} pts`, true);

  const newPoints = c.points - cost;

  try {
    await updateCustomerPoints(custId, newPoints);
    await logActivity({
      customer_id: custId,
      customer_name: c.name,
      action: `-${cost} pts (Redeemed $${qty} voucher)`,
      remark: null,
      negative: true,
    });

    c.points = newPoints;
    history.unshift({
      created_at: new Date().toISOString(),
      customer_name: c.name,
      action: `-${cost} pts (Redeemed $${qty} voucher)`,
      remark: null,
      negative: true,
    });

    render();
    showToast(`$${qty} voucher redeemed for ${c.name}!`);
  } catch (e) {
    showToast('Failed to redeem voucher', true);
  }
};

// ── RENDER ───────────────────────────────────
function render() {
  renderLeaderboard();
  renderCustomerList();
  renderSelects();
  renderHistory();
  const el = document.getElementById('totalCustomers');
  if (el) el.textContent = customers.length;
}

// ── LEADERBOARD ──────────────────────────────
window.toggleShowAll = function() {
  showAllLeaderboard = !showAllLeaderboard;
  renderLeaderboard();
};

function renderLeaderboard() {
  const sorted = [...customers].sort((a, b) => b.points - a.points);
  const wrap = document.getElementById('lbTableWrap');
  if (!wrap) return;

  if (!sorted.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="icon">🎴</div><p>No customers yet. Add some in the Admin panel!</p></div>`;
    return;
  }

  if (!document.getElementById('lbList')) {
    wrap.innerHTML = `
      <table class="lb-table">
        <thead><tr>
          <th class="td-rank">#</th>
          <th>Customer</th>
          <th>Points</th>
          <th>Voucher</th>
        </tr></thead>
        <tbody id="lbList"></tbody>
      </table>
      <button class="lb-show-more" id="lbShowMore" onclick="toggleShowAll()"></button>`;
  }

  const visibleCount = showAllLeaderboard ? sorted.length : Math.min(5, sorted.length);

  document.getElementById('lbList').innerHTML = sorted.slice(0, visibleCount).map((c, i) => {
    const rank = i + 1;
    const vouchers = Math.floor(c.points / 10);
    const remaining = c.points % 10;
    const rankClass = rank <= 3 ? 'rank-' + rank : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    return `<tr class="${rankClass}">
      <td class="td-rank"><div class="rank-chip">${medal}</div></td>
      <td class="td-name">
        <div class="cname">${c.name}</div>
        <div class="csub">${remaining}/10 to next voucher</div>
      </td>
      <td class="td-pts">${c.points}<span style="font-size:12px;color:var(--muted);font-family:'Space Mono',monospace;margin-left:4px;">pts</span></td>
      <td><div class="td-voucher" style="float:right;">$${vouchers}</div></td>
    </tr>`;
  }).join('');

  const btn = document.getElementById('lbShowMore');
  if (btn) {
    if (sorted.length > 5) {
      btn.style.display = 'block';
      btn.textContent = showAllLeaderboard ? '▲ Show Top 5 Only' : `▼ Show All ${sorted.length} Players`;
    } else {
      btn.style.display = 'none';
    }
  }
}

function renderCustomerList() {
  const el = document.getElementById('custList');
  if (!el) return;
  if (!customers.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">No customers yet</div>`;
    return;
  }
  el.innerHTML = customers.map(c => `
    <div class="cust-row">
      <div class="cust-name">${c.name}</div>
      <div class="cust-pts">${c.points} pts</div>
      <button class="btn-danger" onclick="removeCustomer('${c.id}')">✕</button>
    </div>`).join('');
}

function renderSelects() {
  const opts = customers.map(c => `<option value="${c.id}">${c.name} (${c.points} pts)</option>`).join('');
  const sc = document.getElementById('selectCustomer');
  const rc = document.getElementById('redeemCustomer');
  if (sc) sc.innerHTML = '<option value="">— Select customer —</option>' + opts;
  if (rc) rc.innerHTML = '<option value="">— Select —</option>' + opts;
}

function renderHistory() {
  const el = document.getElementById('historyList');
  if (!el) return;
  if (!history.length) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px;font-family:'Space Mono',monospace;">No activity yet</div>`;
    return;
  }
  el.innerHTML = history.slice(0, 20).map(h => {
    const time = new Date(h.created_at).toLocaleTimeString();
    return `
      <div class="history-item" style="flex-direction:column;align-items:flex-start;gap:3px;">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
          <span>${time} · ${h.customer_name}</span>
          <span class="hist-pts ${h.negative ? 'negative' : ''}">${h.action}</span>
        </div>
        ${h.remark ? `<div class="hist-remark">💬 ${h.remark}</div>` : ''}
      </div>`;
  }).join('');
}

// ── TOAST ────────────────────────────────────
function showToast(msg, error = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (error ? ' error' : '');
  setTimeout(() => t.className = 'toast', 2800);
}

// ── INIT EVENT LISTENERS ─────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const redeemQtyEl = document.getElementById('redeemQty');
  if (redeemQtyEl) {
    redeemQtyEl.addEventListener('input', function() {
      document.getElementById('redeemAmt').textContent = parseInt(this.value) || 1;
    });
  }
});
