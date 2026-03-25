<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>
// STATE
{/* let customers = JSON.parse(localStorage.getItem('ptCustomers') || '[]'); */}
let history = JSON.parse(localStorage.getItem('ptHistory') || '[]');

// selectedRarities: { rarity, pts, qty }[]
let selectedRarities = [];

const RARITY_COLORS = {
    'EX': 'var(--ex)', 'AR/SR': 'var(--arsr)', 'IR/FA': 'var(--irfa)',
    'MA': 'var(--ma)', 'SAR/SIR': 'var(--sarsr)', 'MUR/BWR': 'var(--mur)'
};

// INIT
render();

function save() {
    localStorage.setItem('ptCustomers', JSON.stringify(customers));
    localStorage.setItem('ptHistory', JSON.stringify(history));
}

const ADMIN_PW = 'M1dnightPo1nts';
let adminUnlocked = false;

function switchTab(tab) {
    if (tab === 'admin' && !adminUnlocked) {
    showPasswordOverlay();
    return;
    }
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('page-' + tab).classList.add('active');
    if (tab === 'leaderboard') renderLeaderboard();
}

function showPasswordOverlay() {
    document.getElementById('pwOverlay').classList.add('show');
    document.getElementById('pwInput').value = '';
    document.getElementById('pwError').textContent = '';
    setTimeout(() => document.getElementById('pwInput').focus(), 100);
}

function closePasswordOverlay() {
    document.getElementById('pwOverlay').classList.remove('show');
}

function checkPassword() {
    const val = document.getElementById('pwInput').value;
    if (val === ADMIN_PW) {
    adminUnlocked = true;
    closePasswordOverlay();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab')[1].classList.add('active');
    document.getElementById('page-admin').classList.add('active');
    } else {
    const inp = document.getElementById('pwInput');
    inp.classList.add('error');
    document.getElementById('pwError').textContent = 'Incorrect password. Try again.';
    setTimeout(() => inp.classList.remove('error'), 400);
    }
}

function togglePwVisibility() {
    const inp = document.getElementById('pwInput');
    const btn = document.getElementById('pwToggle');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
}

function toggleRarity(btn) {
    const rarity = btn.dataset.rarity;
    const pts = parseInt(btn.dataset.pts);
    const idx = selectedRarities.findIndex(r => r.rarity === rarity);
    if (idx >= 0) {
    // deselect
    selectedRarities.splice(idx, 1);
    btn.classList.remove('selected');
    } else {
    // select
    selectedRarities.push({ rarity, pts, qty: 1 });
    btn.classList.add('selected');
    }
    renderSelectedRarities();
    updatePreview();
}

function renderSelectedRarities() {
    const container = document.getElementById('selectedRarities');
    if (!selectedRarities.length) { container.innerHTML = ''; return; }
    container.innerHTML = selectedRarities.map((r, i) => `
    <div class="rarity-row">
        <div class="rarity-row-label" style="color:${RARITY_COLORS[r.rarity]}">${r.rarity}</div>
        <div class="rarity-row-pts">${r.pts} pt${r.pts>1?'s':''} each</div>
        <div class="qty-inline">
        <button class="qib" onclick="changeRarityQty(${i},-1)">−</button>
        <input class="qiv" type="number" value="${r.qty}" min="1" max="99"
            oninput="setRarityQty(${i},this.value)">
        <button class="qib" onclick="changeRarityQty(${i},1)">+</button>
        </div>
        <div class="rarity-row-subtotal">${r.pts * r.qty} pts</div>
        <button class="rarity-row-remove" onclick="removeRarity('${r.rarity}')">✕</button>
    </div>`).join('');
}

function changeRarityQty(i, delta) {
    selectedRarities[i].qty = Math.max(1, selectedRarities[i].qty + delta);
    renderSelectedRarities();
    updatePreview();
}

function setRarityQty(i, val) {
    selectedRarities[i].qty = Math.max(1, parseInt(val) || 1);
    updatePreview();
    // update subtotal inline without full re-render to avoid cursor jump
    const rows = document.querySelectorAll('.rarity-row');
    if (rows[i]) rows[i].querySelector('.rarity-row-subtotal').textContent = selectedRarities[i].pts * selectedRarities[i].qty + ' pts';
}

function removeRarity(rarity) {
    selectedRarities = selectedRarities.filter(r => r.rarity !== rarity);
    document.querySelectorAll('.rarity-btn').forEach(b => {
    if (b.dataset.rarity === rarity) b.classList.remove('selected');
    });
    renderSelectedRarities();
    updatePreview();
}

function updatePreview() {
    const total = selectedRarities.reduce((s, r) => s + r.pts * r.qty, 0);
    document.getElementById('previewPts').textContent = total > 0 ? total + ' pts' : '—';
    document.getElementById('previewRarity').textContent = selectedRarities.length
    ? selectedRarities.map(r => r.qty + '× ' + r.rarity).join(', ')
    : 'None';
}

function changeRedeemQty(delta) {
    const inp = document.getElementById('redeemQty');
    inp.value = Math.max(1, (parseInt(inp.value) || 1) + delta);
    document.getElementById('redeemAmt').textContent = parseInt(inp.value) || 1;
}

function addCustomer() {
    const name = document.getElementById('newCustomerName').value.trim();
    if (!name) return showToast('Enter a customer name', true);
    if (customers.find(c => c.name.toLowerCase() === name.toLowerCase()))
    return showToast('Customer already exists', true);
    customers.push({ id: Date.now(), name, points: 0 });
    document.getElementById('newCustomerName').value = '';
    save(); render();
    showToast('Customer "' + name + '" added!');
}

function removeCustomer(id) {
    if (!confirm('Remove this customer?')) return;
    customers = customers.filter(c => c.id !== id);
    save(); render();
}

function addPoints() {
    const custId = parseInt(document.getElementById('selectCustomer').value);
    const remarks = document.getElementById('remarksInput').value.trim();
    if (!custId) return showToast('Select a customer', true);
    if (!selectedRarities.length) return showToast('Select at least one rarity', true);

    const total = selectedRarities.reduce((s, r) => s + r.pts * r.qty, 0);
    const c = customers.find(x => x.id === custId);
    c.points += total;

    const breakdown = selectedRarities.map(r => r.qty + '× ' + r.rarity).join(', ');
    history.unshift({
    time: new Date().toLocaleTimeString(),
    name: c.name,
    action: '+' + total + ' pts (' + breakdown + ')',
    remark: remarks || null
    });
    if (history.length > 50) history.pop();

    // reset
    selectedRarities = [];
    document.querySelectorAll('.rarity-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('remarksInput').value = '';
    renderSelectedRarities();
    updatePreview();

    save(); render();
    showToast('+' + total + ' pts added to ' + c.name);
}

function redeemVoucher() {
    const custId = parseInt(document.getElementById('redeemCustomer').value);
    const qty = parseInt(document.getElementById('redeemQty').value) || 1;
    const cost = qty * 10;
    if (!custId) return showToast('Select a customer', true);
    const c = customers.find(x => x.id === custId);
    if (c.points < cost) return showToast('Not enough points! Need ' + cost + ' pts', true);
    c.points -= cost;
    history.unshift({ time: new Date().toLocaleTimeString(), name: c.name, action: '-' + cost + ' pts (Redeemed $' + qty + ' voucher)', negative: true });
    if (history.length > 50) history.pop();
    save(); render();
    showToast('$' + qty + ' voucher redeemed for ' + c.name + '!');
}

function render() {
    renderLeaderboard();
    renderCustomerList();
    renderSelects();
    renderHistory();
    document.getElementById('totalCustomers').textContent = customers.length;
}

let showAllLeaderboard = false;

function toggleShowAll() {
    showAllLeaderboard = !showAllLeaderboard;
    renderLeaderboard();
}

function renderLeaderboard() {
    const sorted = [...customers].sort((a, b) => b.points - a.points);
    const wrap = document.getElementById('lbTableWrap');

    if (!customers.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="icon">🎴</div><p>No customers yet. Add some in the Admin panel!</p></div>`;
    return;
    }

    // Restore table structure if it was replaced by empty state
    if (!document.getElementById('lbList')) {
    wrap.innerHTML = `<table class="lb-table"><thead><tr><th class="td-rank">#</th><th>Customer</th><th>Points</th><th>Voucher</th></tr></thead><tbody id="lbList"></tbody></table><button class="lb-show-more" id="lbShowMore" onclick="toggleShowAll()"></button>`;
    }

    const visibleCount = showAllLeaderboard ? sorted.length : Math.min(5, sorted.length);
    const toShow = sorted.slice(0, visibleCount);

    document.getElementById('lbList').innerHTML = toShow.map((c, i) => {
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
    if (sorted.length > 5) {
    btn.style.display = 'block';
    btn.textContent = showAllLeaderboard ? '▲ Show Top 5 Only' : `▼ Show All ${sorted.length} Players`;
    } else {
    btn.style.display = 'none';
    }
}

function renderCustomerList() {
    const el = document.getElementById('custList');
    if (!customers.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">No customers yet</div>`;
    return;
    }
    el.innerHTML = customers.map(c => `
    <div class="cust-row">
        <div class="cust-name">${c.name}</div>
        <div class="cust-pts">${c.points} pts</div>
        <button class="btn-danger" onclick="removeCustomer(${c.id})">✕</button>
    </div>`).join('');
}

function renderSelects() {
    const opts = customers.map(c => `<option value="${c.id}">${c.name} (${c.points} pts)</option>`).join('');
    document.getElementById('selectCustomer').innerHTML = '<option value="">— Select customer —</option>' + opts;
    document.getElementById('redeemCustomer').innerHTML = '<option value="">— Select —</option>' + opts;
}

function renderHistory() {
    const el = document.getElementById('historyList');
    if (!history.length) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px;font-family:'Space Mono',monospace;">No activity yet</div>`;
    return;
    }
    el.innerHTML = history.slice(0, 20).map(h => `
    <div class="history-item" style="flex-direction:column;align-items:flex-start;gap:3px;">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
        <span>${h.time} · ${h.name}</span>
        <span class="hist-pts ${h.negative ? 'negative' : ''}">${h.action}</span>
        </div>
        ${h.remark ? `<div class="hist-remark">💬 ${h.remark}</div>` : ''}
    </div>`).join('');
}

function showToast(msg, error = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (error ? ' error' : '');
    setTimeout(() => t.className = 'toast', 2800);
}

document.getElementById('redeemQty').addEventListener('input', function() {
    document.getElementById('redeemAmt').textContent = parseInt(this.value) || 1;
});
