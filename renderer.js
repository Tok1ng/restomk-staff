const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://ejenqweuagknvzypsowk.supabase.co'
const SUPABASE_KEY = 'sb_publishable_rAEZrtq88bRXM-8S3ienag_OBQcsfx3'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let orderCounter = 1
let currentUser = null
let currentTab = 'pos'
let currentRestaurant = null
let currentTable = null
let cart = []
let menu = []
let tables = []
let selectedCatIndex = 0
let tableCarts = {}
let lastAddedCartIndex = -1
let kitchenTimerInterval = null
window._internoVisible = true

function showMsg(msg, type = 'error') {
  const color = type === 'success' ? '#4ade80' : '#FCA5A5'
  const bg = type === 'success' ? 'rgba(0,200,100,0.15)' : 'rgba(220,38,38,0.15)'
  const border = type === 'success' ? 'rgba(0,200,100,0.3)' : 'rgba(220,38,38,0.3)'
  const div = document.createElement('div')
  div.style.cssText = `position:fixed;top:80px;right:20px;z-index:9999;padding:12px 20px;border-radius:12px;background:${bg};color:${color};border:1px solid ${border};font-size:14px;font-weight:600;font-family:'Segoe UI',sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.3);`
  div.textContent = msg
  document.body.appendChild(div)
  setTimeout(() => div.remove(), 3000)
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('password')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') login() })
  document.getElementById('email')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') login() })
})

document.addEventListener('keydown', (e) => {
  if (!currentRestaurant) return
  if (e.key === 'F1') switchTab('pos')
  if (e.key === 'F2') { document.getElementById('kitchenBadge').style.display = 'none'; switchTab('kitchen') }
  if (e.key === 'F3') showAdminPin()
  if (e.key === 'Escape') closeItemModal()
  if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); toggleInternoBtn() }
  if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); showSetPin2() }
})

async function login() {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const errorBox = document.getElementById('errorBox')
  if (!email || !password) { errorBox.innerHTML = '<div class="error">❌ Пополни ги сите полиња!</div>'; return }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) { errorBox.innerHTML = `<div class="error">❌ ${error.message}</div>`; return }
  currentUser = data.user
  const { data: profile } = await supabase.from('profiles').select('*, restaurants(*)').eq('id', currentUser.id).single()
  if (!profile?.restaurant_id) { errorBox.innerHTML = '<div class="error">❌ Немаш поврзан ресторан!</div>'; await supabase.auth.signOut(); return }
  currentRestaurant = profile.restaurants
  document.getElementById('restaurantName').textContent = '🏪 ' + currentRestaurant.name
  errorBox.innerHTML = ''
  if (localStorage.getItem('restomk_remember') === 'true') {
    localStorage.setItem('restomk_email', email)
    localStorage.setItem('restomk_pass', password)
  } else {
    localStorage.removeItem('restomk_email')
    localStorage.removeItem('restomk_pass')
  }
  document.getElementById('loginScreen').style.display = 'none'
  document.getElementById('mainScreen').classList.add('active')
  await loadData()
  startListening()
  renderPOS()
}

async function logout() {
  await supabase.auth.signOut()
  document.getElementById('mainScreen').classList.remove('active')
  document.getElementById('loginScreen').style.display = 'flex'
  showLogin()
  currentUser = null; currentRestaurant = null; currentTable = null; cart = []; tableCarts = {}
}

function showLogin() {
  const savedEmail = localStorage.getItem('restomk_email') || ''
  const savedPass = localStorage.getItem('restomk_pass') || ''
  const savedRemember = localStorage.getItem('restomk_remember') === 'true'
  document.getElementById('loginScreen').innerHTML = `
    <div class="login-box">
      <div class="logo"><h1>resto<span class="orange">MK</span></h1><p>Staff Dashboard</p></div>
      <div id="errorBox"></div>
      <div class="input-group"><label>📧 EMAIL</label><input type="email" id="email" placeholder="admin@restoran.mk" value="${savedEmail}" onkeydown="if(event.key==='Enter') login()" /></div>
      <div class="input-group"><label>🔒 ЛОЗИНКА</label><input type="password" id="password" placeholder="••••••••" value="${savedPass}" onkeydown="if(event.key==='Enter') login()" /></div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;cursor:pointer;" onclick="toggleRemember()">
        <div id="rememberBox" style="width:20px;height:20px;border-radius:6px;border:1px solid rgba(255,255,255,0.3);background:${savedRemember ? 'linear-gradient(135deg,#ff5500,#ff9000)' : 'rgba(255,255,255,0.08)'};display:flex;align-items:center;justify-content:center;font-size:13px;">${savedRemember ? '✓' : ''}</div>
        <span style="font-size:13px;color:rgba(255,255,255,0.6);">Запомни ме</span>
      </div>
      <button class="login-btn" onclick="login()">🔑 Влези</button>
      <button class="login-btn" onclick="showRegister()" style="margin-top:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);box-shadow:none;">🏪 Регистрирај ресторан</button>
    </div>`
}

function toggleRemember() {
  const current = localStorage.getItem('restomk_remember') === 'true'
  localStorage.setItem('restomk_remember', !current)
  const box = document.getElementById('rememberBox')
  if (!current) { box.style.background = 'linear-gradient(135deg,#ff5500,#ff9000)'; box.textContent = '✓' }
  else { box.style.background = 'rgba(255,255,255,0.08)'; box.textContent = '' }
}

function showRegister() {
  document.getElementById('loginScreen').innerHTML = `
    <div class="login-box">
      <div class="logo"><h1>resto<span class="orange">MK</span></h1><p>Регистрирај ресторан</p></div>
      <div id="regErrorBox"></div>
      <div class="input-group"><label>🏪 Ime на ресторан</label><input type="text" id="regName" placeholder="пр. Ресторан Македонија" /></div>
      <div class="input-group"><label>📍 Адреса</label><input type="text" id="regAddress" placeholder="пр. Центар, Скопје" /></div>
      <div class="input-group"><label>📞 Телефон</label><input type="text" id="regPhone" placeholder="пр. 078 123 456" /></div>
      <div class="input-group"><label>📧 Email</label><input type="email" id="regEmail" placeholder="restoran@email.com" /></div>
      <div class="input-group"><label>🔒 Лозинка</label><input type="password" id="regPassword" placeholder="Минимум 6 знаци" /></div>
      <button class="login-btn" onclick="registerRestaurant()">🏪 Регистрирај се</button>
      <button class="login-btn" onclick="showLogin()" style="margin-top:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);box-shadow:none;">← Назад</button>
    </div>`
}

async function registerRestaurant() {
  const name = document.getElementById('regName').value.trim()
  const address = document.getElementById('regAddress').value.trim()
  const phone = document.getElementById('regPhone').value.trim()
  const email = document.getElementById('regEmail').value.trim()
  const password = document.getElementById('regPassword').value
  const errorBox = document.getElementById('regErrorBox')
  if (!name || !address || !email || !password) { errorBox.innerHTML = '<div class="error">❌ Пополни ги сите полиња!</div>'; return }
  if (password.length < 6) { errorBox.innerHTML = '<div class="error">❌ Лозинката мора да има минимум 6 знаци!</div>'; return }
  errorBox.innerHTML = '<div style="color:#90E0EF;font-size:13px;padding:10px;">⏳ Се регистрира...</div>'
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) { errorBox.innerHTML = `<div class="error">❌ ${error.message}</div>`; return }
  const { data: restaurant, error: rError } = await supabase.from('restaurants').insert({ name, address, phone, is_active: true }).select().single()
  if (rError) { errorBox.innerHTML = `<div class="error">❌ ${rError.message}</div>`; return }
  await supabase.from('profiles').upsert({ id: data.user.id, name, phone, restaurant_id: restaurant.id, loyalty_points: 0 })
  errorBox.innerHTML = '<div style="color:#4ade80;font-size:13px;padding:10px;">✅ Успешно! Логирај се сега!</div>'
  setTimeout(() => showLogin(), 2000)
}

// FIX #6 — отстранет неискористениот параметар `force`
async function loadData() {
  const { data: t } = await supabase.from('tables').select('*').eq('restaurant_id', currentRestaurant.id).order('table_number')
  tables = t || []
  const { data: m } = await supabase.from('menu_categories').select('*, menu_items(*)').eq('restaurant_id', currentRestaurant.id).eq('is_active', true).order('display_order')
  menu = m || []
}

function switchTab(tab) {
  currentTab = tab
  document.getElementById('posTab').classList.toggle('active', tab === 'pos')
  document.getElementById('kitchenTab').classList.toggle('active', tab === 'kitchen')
  document.getElementById('adminTab').classList.remove('active')
  if (tab === 'pos') renderPOS()
  else { document.getElementById('kitchenBadge').style.display = 'none'; renderKitchen() }
}

function selectTable(tableId, tableNumber) {
  if (currentTable) tableCarts[currentTable.id] = [...cart]
  currentTable = tables.find(t => t.id === tableId)
  cart = tableCarts[tableId] ? [...tableCarts[tableId]] : []
  renderPOS()
}

function renderPOS() {
  currentTab = 'pos'
  document.getElementById('posTab').classList.add('active')
  document.getElementById('kitchenTab').classList.remove('active')
  document.getElementById('adminTab').classList.remove('active')
  const content = document.getElementById('contentArea')
  content.innerHTML = `
    <div style="display:flex;height:100%;width:100%;">
      <div style="flex:1;display:flex;flex-direction:column;min-width:0;background:#1a1a2e;">
        <div style="padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;flex-shrink:0;background:#16213e;">
          <span style="font-size:16px;font-weight:700;">${currentTable ? `🍽️ Маса ${currentTable.table_number}` : '← Избери маса'}</span>
          ${currentTable && cart.length > 0 ? `<span style="padding:4px 12px;border-radius:10px;background:linear-gradient(135deg,#ff5500,#ff9000);font-size:12px;font-weight:700;">${cart.length} артикли</span>` : ''}
        </div>
        ${currentTable ? `
        <div style="padding:10px 24px;overflow-y:auto;max-height:220px;flex-shrink:0;" id="cartArea">${renderCartItems()}</div>
        <div style="padding:10px 24px;border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;background:rgba(255,100,0,0.08);flex-shrink:0;">
          <span style="font-size:14px;color:rgba(255,255,255,0.6);">Вкупно:</span>
          <span style="font-size:20px;font-weight:800;color:#ff8030;" id="totalAmount">${cart.reduce((s, i) => s + i.price * i.qty, 0)} ден</span>
        </div>
        <div style="padding:10px 24px 6px;flex-shrink:0;">
          <input type="text" placeholder="🔍 Пребарај јадење..." oninput="filterMenu(this.value)" style="width:100%;padding:10px 16px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:white;font-size:13px;outline:none;font-family:'Segoe UI',sans-serif;" />
        </div>
        <div style="display:flex;gap:8px;padding:8px 24px;overflow-x:auto;flex-shrink:0;" id="categoryTabs">
          ${menu.map((cat, i) => `<button onclick="selectCategory(${i})" id="cat-${i}" style="padding:9px 18px;border-radius:14px;font-size:13px;font-weight:700;white-space:nowrap;cursor:pointer;border:none;background:${i === 0 ? 'linear-gradient(135deg,#ff5500,#ff9000)' : 'rgba(255,255,255,0.1)'};color:white;font-family:'Segoe UI',sans-serif;">${cat.name}</button>`).join('')}
        </div>
        <div style="flex:1;padding:10px 24px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;align-content:start;" id="menuGrid">${renderMenuItems(0)}</div>
        <div style="padding:14px 24px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:10px;flex-shrink:0;background:#16213e;">
          <button onclick="clearCart()" style="padding:12px 18px;border-radius:12px;background:rgba(220,38,38,0.2);color:#FCA5A5;border:1px solid rgba(220,38,38,0.3);font-weight:600;cursor:pointer;font-size:14px;">🗑️</button>
          <button onclick="sendToKitchen()" style="flex:1;padding:14px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:15px;cursor:pointer;font-family:'Segoe UI',sans-serif;">🍳 Испрати во кујна</button>
          <button onclick="payOrder()" style="padding:14px 22px;border-radius:12px;background:linear-gradient(135deg,#1565C0,#00B4D8);color:white;border:none;font-weight:700;font-size:15px;cursor:pointer;font-family:'Segoe UI',sans-serif;">💳 Наплати</button>
        </div>
        ` : `<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:rgba(255,255,255,0.3);"><span style="font-size:56px;">🪑</span><p style="font-size:16px;">Избери маса од десно</p></div>`}
      </div>
      <div style="width:140px;background:#16213e;border-left:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;flex-shrink:0;">
        <div style="padding:14px 8px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:center;">
          <p style="font-size:14px;font-weight:700;">🪑 Маси</p>
          <p style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">${tables.length} вкупно</p>
        </div>
        <div style="flex:1;padding:8px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
          ${tables.length === 0 ? `<div style="text-align:center;padding:16px 8px;color:rgba(255,255,255,0.3);font-size:11px;">Нема маси.<br/>Додај во Админ.</div>` :
      tables.map(table => {
        const hasItems = tableCarts[table.id]?.length > 0 && table.id !== currentTable?.id
        return `<div onclick="selectTable('${table.id}', ${table.table_number})" style="padding:12px 5px;border-radius:10px;cursor:pointer;text-align:center;border:2px solid ${currentTable?.id === table.id ? 'white' : table.status === 'ЗАФАТЕНА' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'};background:${currentTable?.id === table.id ? 'linear-gradient(135deg,#ff5500,#ff9000)' : table.status === 'ЗАФАТЕНА' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)'};">
                <div style="font-size:20px;font-weight:900;">${table.table_number}</div>
                <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;opacity:0.8;margin-top:2px;">${currentTable?.id === table.id ? 'Активна' : table.status === 'ЗАФАТЕНА' ? 'Зафатена' : hasItems ? '🟡 Отворена' : 'Слободна'}</div>
              </div>`
      }).join('')}
        </div>
      </div>
    </div>`
}

function renderCartItems() {
  if (cart.length === 0) return '<p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;padding:10px;">Кошничката е празна</p>'
  return cart.map((item, i) => `
    <div onclick="handleCartClick(${i})" style="padding:8px 12px;border-radius:10px;background:${item.paid ? 'rgba(22,101,52,0.3)' : 'rgba(255,255,255,0.07)'};border:1px solid ${item.paid ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'};margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;opacity:${item.paid ? '0.6' : '1'};">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <div style="width:26px;height:26px;border-radius:7px;background:${item.paid ? 'rgba(34,197,94,0.5)' : 'linear-gradient(135deg,#1565C0,#00B4D8)'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;">${item.paid ? '✓' : item.qty}</div>
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}${item.paid ? ' ✅' : ''}</div>
          ${item.notes ? `<div style="font-size:10px;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.notes}</div>` : ''}
        </div>
      </div>
      ${!item.paid ? `
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;" onclick="event.stopPropagation()">
        <button onclick="changeQty(${i}, -1)" style="width:20px;height:20px;border-radius:5px;background:rgba(255,255,255,0.1);border:none;color:white;cursor:pointer;font-size:13px;font-family:'Segoe UI',sans-serif;">−</button>
        <button onclick="changeQty(${i}, 1)" style="width:20px;height:20px;border-radius:5px;background:rgba(255,255,255,0.1);border:none;color:white;cursor:pointer;font-size:13px;font-family:'Segoe UI',sans-serif;">+</button>
        <span style="font-size:13px;font-weight:700;color:#ff8030;min-width:60px;text-align:right;">${item.price * item.qty} ден</span>
        <button onclick="removeFromCart(${i})" style="width:20px;height:20px;border-radius:5px;background:rgba(220,38,38,0.2);border:none;color:#FCA5A5;cursor:pointer;font-size:11px;">✕</button>
      </div>` : `<span style="font-size:12px;color:#4ade80;font-weight:700;flex-shrink:0;">ПЛАТЕНО</span>`}
    </div>`).join('')
}

function renderMenuItems(catIndex) {
  const cat = menu[catIndex]
  if (!cat) return '<p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;padding:20px;">Нема јадења</p>'
  const items = (cat.menu_items || []).filter(i => i.is_available)
  if (items.length === 0) return '<p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;padding:20px;">Нема јадења</p>'
  return items.map(item => `
    <div onclick="addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})" style="padding:10px 8px;border-radius:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);cursor:pointer;text-align:center;" onmouseover="this.style.background='rgba(255,100,0,0.15)';this.style.borderColor='rgba(255,100,0,0.4)'" onmouseout="this.style.background='rgba(255,255,255,0.07)';this.style.borderColor='rgba(255,255,255,0.1)'">
      <div style="font-size:12px;font-weight:600;line-height:1.3;margin-bottom:4px;">${item.name}</div>
      <div style="font-size:13px;font-weight:700;color:#ff8030;">${item.price} ден</div>
    </div>`).join('')
}

function addToCart(id, name, price) {
  const existing = cart.find(i => i.id === id && !i.notes)
  if (existing) existing.qty++
  else cart.push({ id, name, price, qty: 1, notes: '' })
  updateCartDisplay()
}

function updateCartDisplay() {
  const cartArea = document.getElementById('cartArea')
  if (cartArea) cartArea.innerHTML = renderCartItems()
  const totalEl = document.getElementById('totalAmount')
  if (totalEl) totalEl.textContent = cart.reduce((s, i) => s + i.price * i.qty, 0) + ' ден'
}

function changeQty(index, delta) {
  cart[index].qty += delta
  if (cart[index].qty <= 0) cart.splice(index, 1)
  updateCartDisplay()
}

function removeFromCart(index) { cart.splice(index, 1); updateCartDisplay() }

function clearCart() {
  cart = []
  if (currentTable) tableCarts[currentTable.id] = []
  renderPOS()
}

function selectCategory(i) {
  selectedCatIndex = i
  document.querySelectorAll('[id^="cat-"]').forEach((btn, idx) => {
    btn.style.background = idx === i ? 'linear-gradient(135deg,#ff5500,#ff9000)' : 'rgba(255,255,255,0.1)'
  })
  document.getElementById('menuGrid').innerHTML = renderMenuItems(i)
}

function filterMenu(search) {
  const grid = document.getElementById('menuGrid')
  if (!grid) return
  if (!search) { grid.innerHTML = renderMenuItems(selectedCatIndex); return }
  const allItems = menu.flatMap(c => c.menu_items || []).filter(i => i.is_available)
  const filtered = allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
  if (filtered.length === 0) { grid.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;padding:20px;">Нема резултати</p>'; return }
  grid.innerHTML = filtered.map(item => `
    <div onclick="addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})" style="padding:10px 8px;border-radius:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);cursor:pointer;text-align:center;" onmouseover="this.style.background='rgba(255,100,0,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.07)'">
      <div style="font-size:12px;font-weight:600;line-height:1.3;margin-bottom:4px;">${item.name}</div>
      <div style="font-size:13px;font-weight:700;color:#ff8030;">${item.price} ден</div>
    </div>`).join('')
}

let cartClickTimer = null
function handleCartClick(index) {
  if (cartClickTimer) { clearTimeout(cartClickTimer); cartClickTimer = null; changeQty(index, -1) }
  else { cartClickTimer = setTimeout(() => { cartClickTimer = null; editCartItem(index) }, 250) }
}

async function editCartItem(index) {
  const item = cart[index]
  if (!item) return
  const { data: ingredients } = await supabase.from('ingredients').select('*').eq('restaurant_id', currentRestaurant.id)
  const { data: extras } = await supabase.from('extras').select('*').eq('restaurant_id', currentRestaurant.id)
  const ings = ingredients || []
  const exts = extras || []
  const notesParts = item.notes ? item.notes.split(' | ') : []
  const soText = notesParts.find(n => n.startsWith('со:'))
  const extText = notesParts.find(n => n.startsWith('+'))
  const soNames = soText ? soText.replace('со: ', '').split(', ') : []
  const extNames = extText ? extText.replace('+ ', '').split(', ') : []
  const checkedIngs = new Set(item.notes ? ings.filter(i => soNames.includes(i.name)).map(i => i.id) : [])
  const checkedExts = new Set(exts.filter(e => extNames.includes(e.name)).map(e => e.id))
  const basePrice = item.price - exts.filter(e => checkedExts.has(e.id)).reduce((s, e) => s + e.price, 0)
  const modal = document.createElement('div')
  modal.id = 'itemModal'
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;'
  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="width:460px;max-height:85vh;overflow-y:auto;border-radius:20px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
        <div><h3 style="font-size:18px;font-weight:700;">${item.name}</h3><p style="color:#ff8030;font-weight:700;font-size:15px;margin-top:4px;" id="modalTotal">${item.price} ден</p></div>
        <button onclick="closeItemModal()" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;color:white;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div style="padding:20px 24px;">
        ${ings.length > 0 ? `
        <div style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">🥗 Состојки</p>
            <button onclick="selectAllIngs()" style="padding:4px 10px;border-radius:8px;background:rgba(0,180,216,0.15);color:#00B4D8;border:1px solid rgba(0,180,216,0.3);font-size:11px;cursor:pointer;font-family:'Segoe UI',sans-serif;">Избери сè</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${ings.map(ing => `<div onclick="toggleIngredient('${ing.id}')" id="ing-${ing.id}" style="padding:10px 14px;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:10px;background:${checkedIngs.has(ing.id) ? 'rgba(0,180,216,0.1)' : 'rgba(255,255,255,0.05)'};border:1px solid ${checkedIngs.has(ing.id) ? 'rgba(0,180,216,0.2)' : 'rgba(255,255,255,0.1)'};">
              <div id="ing-icon-${ing.id}" style="width:18px;height:18px;border-radius:4px;border:2px solid ${checkedIngs.has(ing.id) ? '#00B4D8' : 'rgba(255,255,255,0.3)'};background:${checkedIngs.has(ing.id) ? '#00B4D8' : 'transparent'};flex-shrink:0;"></div>
              <span style="font-size:14px;">${ing.name}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}
        ${exts.length > 0 ? `
        <div style="margin-bottom:20px;">
          <p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">➕ Додатоци</p>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${exts.map(ext => `<div onclick="toggleExtra('${ext.id}', ${ext.price})" id="ext-${ext.id}" style="padding:10px 14px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:${checkedExts.has(ext.id) ? 'rgba(253,224,71,0.1)' : 'rgba(255,255,255,0.05)'};border:1px solid ${checkedExts.has(ext.id) ? 'rgba(253,224,71,0.25)' : 'rgba(255,255,255,0.1)'};">
              <div style="display:flex;align-items:center;gap:10px;"><span style="font-size:16px;" id="ext-icon-${ext.id}">${checkedExts.has(ext.id) ? '✅' : '⬜'}</span><span style="font-size:14px;">${ext.name}</span></div>
              <span style="color:#FDE047;font-weight:700;font-size:13px;">+${ext.price} ден</span>
            </div>`).join('')}
          </div>
        </div>` : ''}
        <button onclick="saveEditedCartItem(${index})" style="width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Зачувај промени</button>
      </div>
    </div>`
  modal.onclick = closeItemModal
  document.body.appendChild(modal)
  window._modalState = { itemId: item.id, itemName: item.name, itemPrice: item.price, checkedIngs, checkedExts, ings, exts, basePrice }
}

function saveEditedCartItem(index) {
  const state = window._modalState
  const keptIngs = state.ings.filter(i => state.checkedIngs.has(i.id)).map(i => i.name)
  const selectedExts = state.exts.filter(e => state.checkedExts.has(e.id))
  const extrasPrice = selectedExts.reduce((s, e) => s + e.price, 0)
  const notes = [keptIngs.length > 0 ? `со: ${keptIngs.join(', ')}` : '', selectedExts.map(e => e.name).join(', ') ? `+ ${selectedExts.map(e => e.name).join(', ')}` : ''].filter(Boolean).join(' | ')
  const finalPrice = state.basePrice + extrasPrice
  if (notes === cart[index].notes) { closeItemModal(); return }
  if (cart[index].qty > 1) {
    const qty = cart[index].qty
    const confirmDiv = document.createElement('div')
    confirmDiv.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;'
    confirmDiv.innerHTML = `<div style="width:360px;padding:32px;border-radius:20px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);text-align:center;">
      <p style="font-size:18px;font-weight:700;margin-bottom:8px;">⚠️ Промена за сите?</p>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:24px;">Имаш ${qty}x ${cart[index].name}. Сакаш ли да ја примениш промената на сите?</p>
      <div style="display:flex;gap:10px;">
        <button onclick="applyEditAll(${index}, false)" style="flex:1;padding:12px;border-radius:12px;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.2);font-weight:600;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">❌ Не, само еден</button>
        <button onclick="applyEditAll(${index}, true)" style="flex:1;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Да, сите</button>
      </div>
    </div>`
    document.body.appendChild(confirmDiv)
    window._editConfirmData = { index, notes, finalPrice, confirmDiv }
  } else {
    cart[index] = { ...cart[index], price: finalPrice, notes }
    closeItemModal()
    updateCartDisplay()
  }
}

function applyEditAll(index, applyAll) {
  const { notes, finalPrice, confirmDiv } = window._editConfirmData
  confirmDiv.remove()
  if (applyAll) { cart[index] = { ...cart[index], price: finalPrice, notes } }
  else { const original = cart[index]; original.qty--; if (original.qty <= 0) cart.splice(index, 1); cart.push({ ...original, qty: 1, price: finalPrice, notes }) }
  window._editConfirmData = null
  closeItemModal()
  updateCartDisplay()
}

function selectAllIngs() {
  const state = window._modalState
  if (!state) return
  state.ings.forEach(ing => {
    state.checkedIngs.add(ing.id)
    const icon = document.getElementById(`ing-icon-${ing.id}`)
    const row = document.getElementById(`ing-${ing.id}`)
    if (icon) { icon.style.background = '#00B4D8'; icon.style.borderColor = '#00B4D8' }
    if (row) { row.style.background = 'rgba(0,180,216,0.1)'; row.style.borderColor = 'rgba(0,180,216,0.2)' }
  })
}

function toggleIngredient(id) {
  const state = window._modalState
  const icon = document.getElementById(`ing-icon-${id}`)
  const row = document.getElementById(`ing-${id}`)
  if (state.checkedIngs.has(id)) {
    state.checkedIngs.delete(id); icon.style.background = 'transparent'; icon.style.borderColor = 'rgba(255,255,255,0.3)'; row.style.background = 'rgba(255,255,255,0.05)'; row.style.borderColor = 'rgba(255,255,255,0.1)'
  } else {
    state.checkedIngs.add(id); icon.style.background = '#00B4D8'; icon.style.borderColor = '#00B4D8'; row.style.background = 'rgba(0,180,216,0.1)'; row.style.borderColor = 'rgba(0,180,216,0.2)'
  }
}

function toggleExtra(id, price) {
  const state = window._modalState
  const icon = document.getElementById(`ext-icon-${id}`)
  const row = document.getElementById(`ext-${id}`)
  if (state.checkedExts.has(id)) {
    state.checkedExts.delete(id); icon.textContent = '⬜'; row.style.background = 'rgba(255,255,255,0.05)'; row.style.borderColor = 'rgba(255,255,255,0.1)'
  } else {
    state.checkedExts.add(id); icon.textContent = '✅'; row.style.background = 'rgba(253,224,71,0.1)'; row.style.borderColor = 'rgba(253,224,71,0.25)'
  }
  const extrasTotal = [...state.checkedExts].reduce((sum, extId) => { const ext = state.exts.find(e => e.id === extId); return sum + (ext?.price || 0) }, 0)
  const totalEl = document.getElementById('modalTotal')
  if (totalEl) totalEl.textContent = (state.itemPrice + extrasTotal) + ' ден'
}

async function openItemModal(itemId, itemName, itemPrice) {
  const { data: ingredients } = await supabase.from('ingredients').select('*').eq('restaurant_id', currentRestaurant.id)
  const { data: extras } = await supabase.from('extras').select('*').eq('restaurant_id', currentRestaurant.id)
  const ings = ingredients || []
  const exts = extras || []
  const existingItem = lastAddedCartIndex >= 0 && cart.length > 0 ? cart[lastAddedCartIndex] : null
  const modal = document.createElement('div')
  modal.id = 'itemModal'
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;'
  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="width:460px;max-height:85vh;overflow-y:auto;border-radius:20px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
        <div><h3 style="font-size:18px;font-weight:700;">${itemName}</h3><p style="color:#ff8030;font-weight:700;font-size:15px;margin-top:4px;" id="modalTotal">${itemPrice} ден</p></div>
        <button onclick="closeItemModal()" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;color:white;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div style="padding:20px 24px;">
        ${ings.length > 0 ? `<div style="margin-bottom:20px;"><p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🥗 Состојки</p><div style="display:flex;flex-direction:column;gap:6px;">${ings.map(ing => `<div onclick="toggleIngredient('${ing.id}')" id="ing-${ing.id}" style="padding:10px 14px;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);"><div id="ing-icon-${ing.id}" style="width:18px;height:18px;border-radius:4px;border:2px solid rgba(255,255,255,0.3);background:transparent;flex-shrink:0;"></div><span style="font-size:14px;">${ing.name}</span></div>`).join('')}</div></div>` : ''}
        ${exts.length > 0 ? `<div style="margin-bottom:20px;"><p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">➕ Додатоци</p><div style="display:flex;flex-direction:column;gap:6px;">${exts.map(ext => `<div onclick="toggleExtra('${ext.id}', ${ext.price})" id="ext-${ext.id}" style="padding:10px 14px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);"><div style="display:flex;align-items:center;gap:10px;"><span style="font-size:16px;" id="ext-icon-${ext.id}">⬜</span><span style="font-size:14px;">${ext.name}</span></div><span style="color:#FDE047;font-weight:700;font-size:13px;">+${ext.price} ден</span></div>`).join('')}</div></div>` : ''}
        <div style="display:flex;gap:10px;margin-top:8px;">
          ${existingItem ? `<button onclick="addSameAsExisting('${itemId}', '${itemName.replace(/'/g, "\\'")}', ${itemPrice})" style="flex:1;padding:12px;border-radius:12px;background:rgba(0,180,216,0.15);color:#00B4D8;border:1px solid rgba(0,180,216,0.3);font-weight:700;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">🔁 Исто</button>` : ''}
          <button onclick="saveItemFromModal('${itemId}', '${itemName.replace(/'/g, "\\'")}', ${itemPrice})" style="flex:2;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Зачувај и додај</button>
        </div>
      </div>
    </div>`
  modal.onclick = closeItemModal
  document.body.appendChild(modal)
  window._modalState = { itemId, itemName, itemPrice, checkedIngs: new Set(), checkedExts: new Set(), ings, exts }
}

function saveItemFromModal(itemId, itemName, itemPrice) {
  const state = window._modalState
  const keptIngs = state.ings.filter(i => state.checkedIngs.has(i.id)).map(i => i.name)
  const selectedExts = state.exts.filter(e => state.checkedExts.has(e.id))
  const extrasPrice = selectedExts.reduce((s, e) => s + e.price, 0)
  const notes = [keptIngs.length > 0 ? `со: ${keptIngs.join(', ')}` : '', selectedExts.map(e => e.name).join(', ') ? `+ ${selectedExts.map(e => e.name).join(', ')}` : ''].filter(Boolean).join(' | ')
  const finalPrice = itemPrice + extrasPrice
  const existing = cart.find(i => i.id === itemId && i.notes === notes)
  if (existing) { existing.qty++; lastAddedCartIndex = cart.indexOf(existing) }
  else { cart.push({ id: itemId, name: itemName, price: finalPrice, qty: 1, notes }); lastAddedCartIndex = cart.length - 1 }
  closeItemModal()
  updateCartDisplay()
}

function addSameAsExisting(itemId, itemName, itemPrice) {
  if (lastAddedCartIndex < 0 || lastAddedCartIndex >= cart.length) { closeItemModal(); return }
  const ref = cart[lastAddedCartIndex]
  const notes = ref.notes || ''
  const duplicate = cart.find(i => i.id === itemId && i.notes === notes)
  if (duplicate) { duplicate.qty++; lastAddedCartIndex = cart.indexOf(duplicate) }
  else { cart.push({ id: itemId, name: itemName, price: itemPrice, qty: 1, notes }); lastAddedCartIndex = cart.length - 1 }
  closeItemModal()
  updateCartDisplay()
}

function closeItemModal() {
  const modal = document.getElementById('itemModal')
  if (modal) modal.remove()
  window._modalState = null
}

async function sendToKitchen() {
  if (cart.length === 0) { showMsg('❌ Кошничката е празна!'); return }
  if (!currentTable) { showMsg('❌ Избери маса!'); return }
  const total = cart.filter(i => !i.paid).reduce((s, i) => s + i.price * i.qty, 0)
  const { data: order, error } = await supabase.from('orders').insert({
    restaurant_id: currentRestaurant.id, table_id: currentTable.id, status: 'НОВА', total_amount: total, payment_status: 'НЕПЛАТЕНО'
  }).select().single()
  if (error) { showMsg('❌ ' + error.message); return }
  await supabase.from('order_items').insert(cart.filter(i => !i.paid).map(item => ({
    order_id: order.id, menu_item_id: item.id, quantity: item.qty, unit_price: item.price, notes: item.notes || null, payment_status: 'НЕПЛАТЕНО'
  })))
  await supabase.from('tables').update({ status: 'ЗАФАТЕНА' }).eq('id', currentTable.id)
  await loadData()
  try {
    const { ipcRenderer } = require('electron')
    await ipcRenderer.invoke('print-kitchen', {
      tableNumber: currentTable.table_number, orderNumber: orderCounter++, time: new Date().toLocaleTimeString('mk-MK'), restaurantName: currentRestaurant.name,
      items: cart.map(item => ({ quantity: item.qty, name: item.name, notes: item.notes && item.notes.trim() !== '' ? item.notes : '' }))
    })
  } catch (e) { console.log('Принтер не е поврзан:', e.message) }
  tableCarts[currentTable.id] = []
  cart = []
  showMsg('✅ Нарачката е испратена во кујна!', 'success')
  document.getElementById('kitchenBadge').style.display = 'flex'
  renderPOS()
}

async function payOrder() {
  if (!currentTable) { showMsg('❌ Избери маса!'); return }
  const unpaidCart = cart.filter(i => !i.paid)
  if (!unpaidCart || unpaidCart.length === 0) { showMsg('❌ Нема неплатени артикли!'); return }
  const total = unpaidCart.reduce((s, i) => s + i.price * i.qty, 0)
  const allItems = unpaidCart.map(item => ({ key: item.id + '|' + (item.notes || ''), id: item.id, menu_item_id: item.id, name: item.name, quantity: item.qty, unit_price: item.price, total: item.price * item.qty, notes: item.notes || null }))
  window._naplataState = { orderIds: null, allItems, total, payType: 'ГОТОВИНА', tableId: currentTable.id, remainingItems: allItems.map(i => ({ ...i })), cartSnapshot: unpaidCart, fullCartSnapshot: JSON.parse(JSON.stringify(cart)), fromPOS: true }
  renderNaplataModal(false)
}

// FIX #1 — додаден JOIN со tables за да се прикаже бројот на масата
async function renderKitchen(silent = false) {
  currentTab = 'kitchen'
  const content = document.getElementById('contentArea')
  const scrollEl = content.querySelector('[style*="overflow-y:auto"]')
  const scrollTop = scrollEl?.scrollTop || 0
  if (!silent) content.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;"><p style="color:#90E0EF;font-size:16px;">Се вчитува...</p></div>'
  const { data: orders } = await supabase.from('orders')
    .select('*, order_items(*, menu_items(name)), tables(table_number)')
    .eq('restaurant_id', currentRestaurant.id)
    .neq('status', 'ДОСТАВЕНА')
    .order('created_at', { ascending: true })
  const statusConfig = {
    'НОВА': { bg: 'rgba(250,204,21,0.1)', border: 'rgba(250,204,21,0.4)', color: '#FDE047', label: '🆕 НОВА' },
    'ВО ПОДГОТОВКА': { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.4)', color: '#FDBA74', label: '👨‍🍳 ВО ПОДГОТОВКА' },
    'ГОТОВА': { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.4)', color: '#86EFAC', label: '🍽️ ГОТОВА' },
  }
  const nextStatus = { 'НОВА': 'ВО ПОДГОТОВКА', 'ВО ПОДГОТОВКА': 'ГОТОВА' }
  const nextLabel = { 'НОВА': '✅ Прифати и започни', 'ВО ПОДГОТОВКА': '🍽️ Готово' }
  const nextBg = { 'НОВА': 'linear-gradient(135deg,#ff5500,#ff9000)', 'ВО ПОДГОТОВКА': 'linear-gradient(135deg,#1565C0,#00B4D8)' }
  if (!orders || orders.length === 0) {
    content.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;color:#90E0EF;"><p style="font-size:64px;">✅</p><p style="font-size:22px;font-weight:bold;color:white;">Нема активни нарачки</p></div>`
    return
  }
  content.innerHTML = `
    <div style="padding:20px;width:100%;height:100%;overflow-y:auto;">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
        ${orders.map((order, idx) => {
    const items = order.order_items || []
    const plateni = items.filter(i => i.payment_status === 'ПЛАТЕНО').length
    const vkupno = items.length
    const delumno = plateni > 0 && plateni < vkupno
    const s = order.payment_status === 'ПЛАТЕНО' ? { bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.4)', color: '#D8B4FE', label: '✅ ПЛАТЕНО' }
      : delumno ? { bg: 'rgba(253,224,71,0.08)', border: 'rgba(253,224,71,0.3)', color: '#FDE047', label: '⚠️ ДЕЛУМНО ПЛАТЕНА' }
        : statusConfig[order.status] || statusConfig['НОВА']
    // FIX #1 — прикажи го бројот на масата
    const tableNum = order.tables?.table_number || '?'
    return `
            <div style="border-radius:16px;padding:18px;background:${s.bg};border:2px solid ${s.border};">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <p style="font-weight:bold;font-size:16px;">🍽️ Маса ${tableNum} — #${idx + 1}</p>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                <span style="padding:4px 12px;border-radius:20px;background:rgba(0,0,0,0.3);color:${s.color};font-size:12px;font-weight:700;">${s.label}</span>
                ${order.ready_at && order.status === 'ВО ПОДГОТОВКА' ? `<span id="timer-${order.id}" style="padding:3px 10px;border-radius:20px;background:rgba(0,0,0,0.3);color:#90E0EF;font-size:11px;font-weight:700;">⏱️ ...</span>` : ''}
              </div>
              </div>
              ${order.customer_phone ? `<p style="color:#90E0EF;font-size:12px;margin-bottom:6px;">📱 ${order.customer_phone}</p>` : ''}
              ${order.general_notes ? `<p style="color:#FDE047;font-size:12px;margin-bottom:8px;">📝 ${order.general_notes}</p>` : ''}
              <div style="margin-bottom:12px;">
                ${order.order_items.map(item => `
                  <div style="padding:7px 10px;border-radius:8px;background:rgba(0,0,0,0.2);margin-bottom:5px;${item.payment_status === 'ПЛАТЕНО' ? 'opacity:0.5;' : ''}">
                    <div style="display:flex;justify-content:space-between;">
                      <span style="font-size:13px;font-weight:600;">${item.quantity}x ${item.menu_items?.name}${item.payment_status === 'ПЛАТЕНО' ? ' ✅' : ''}</span>
                      <span style="font-size:12px;color:rgba(255,255,255,0.5);">${item.unit_price * item.quantity} ден</span>
                    </div>
                    ${item.notes ? `<div style="margin-top:4px;">${item.notes.split(' | ').map(n => n.trim() ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;margin-right:4px;margin-top:3px;background:${n.startsWith('со:') ? 'rgba(34,197,94,0.15)' : 'rgba(253,224,71,0.15)'};color:${n.startsWith('со:') ? '#86EFAC' : '#FDE047'};">${n.startsWith('со:') ? '✅' : '➕'} ${n}</span>` : '').join('')}</div>` : ''}
                  </div>`).join('')}
              </div>
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid rgba(255,255,255,0.1);margin-bottom:12px;">
                <span style="color:rgba(255,255,255,0.6);font-size:13px;">Вкупно:</span>
                <span style="color:white;font-weight:bold;">${order.total_amount} ден</span>
              </div>
              ${order.status === 'НОВА' ? `<button onclick="openTimerModal('${order.id}')" style="width:100%;padding:12px;border-radius:10px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Прифати и започни</button>`
        : order.status === 'ВО ПОДГОТОВКА' ? `<button onclick="updateOrderStatus('${order.id}','ГОТОВА')" style="width:100%;padding:12px;border-radius:10px;background:linear-gradient(135deg,#1565C0,#00B4D8);color:white;border:none;font-weight:700;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">🍽️ Готово</button>`
          : order.status === 'ГОТОВА' && order.payment_status === 'ПЛАТЕНО' ? `<button onclick="updateOrderStatus('${order.id}','ДОСТАВЕНА')" style="width:100%;padding:12px;border-radius:10px;background:linear-gradient(135deg,#16a34a,#22c55e);color:white;border:none;font-weight:700;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✔️ Доставено</button>`
            : order.status === 'ГОТОВА' ? `<button onclick="goToNaplata('${order.id}')" style="width:100%;padding:12px;border-radius:10px;background:linear-gradient(135deg,#16a34a,#22c55e);color:white;border:none;font-weight:700;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">💰 Кон наплата</button>`
              : ''}
            </div>`
  }).join('')}
      </div>
    </div>`
  setTimeout(() => {
    const newScrollEl = content.querySelector('[style*="overflow-y:auto"]')
    if (newScrollEl) newScrollEl.scrollTop = scrollTop
    startKitchenTimers(orders)
  }, 50)
}

// FIX #2 — updateOrderStatus ја ослободува масата кога статусот е ДОСТАВЕНА
async function updateOrderStatus(orderId, newStatus) {
  await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
  if (newStatus === 'ГОТОВА') {
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription').eq('order_id', orderId)
    if (subs && subs.length > 0) {
      for (const sub of subs) {
        try {
          await fetch('https://restaurant-platform-navy.vercel.app/api/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: sub.subscription,
              title: '🍽️ Нарачката е готова!',
              body: 'Вашата нарачка е подготвена. Келнерот ќе ви ја донесе!'
            })
          })
        } catch(e) { console.log('Push error:', e) }
      }
    }
  }
  if (newStatus === 'ДОСТАВЕНА') {
    const { data: order } = await supabase.from('orders').select('table_id').eq('id', orderId).single()
    if (order?.table_id) {
      const { data: active } = await supabase.from('orders')
        .select('id').eq('table_id', order.table_id).neq('status', 'ДОСТАВЕНА')
      if (!active || active.length === 0) {
        await supabase.from('tables').update({ status: 'СЛОБОДНА' }).eq('id', order.table_id)
        await loadData()
      }
    }
  }
  renderKitchen(true)
}

async function goToNaplata(orderId) {
  const { data: order } = await supabase.from('orders').select('*, order_items(*, menu_items(name, price))').eq('id', orderId).single()
  if (!order) { showMsg('❌ Нема нарачка!'); return }
  const allItems = order.order_items.filter(item => item.payment_status !== 'ПЛАТЕНО').map(item => ({
    key: item.menu_item_id + '|' + (item.notes || ''), id: item.id, menu_item_id: item.menu_item_id, name: item.menu_items?.name, quantity: item.quantity, unit_price: item.unit_price, total: item.unit_price * item.quantity, notes: item.notes, order_id: order.id
  }))
  const total = allItems.reduce((s, i) => s + i.total, 0)
  window._naplataState = { orderIds: [order.id], allItems, total, payType: 'ГОТОВИНА', tableId: order.table_id, remainingItems: allItems.map(i => ({ ...i })), fromPOS: false }
  renderNaplataModal(false)
}

function renderNaplataModal(isPodelba) {
  const state = window._naplataState
  const items = state.remainingItems
  const total = items.reduce((s, i) => s + i.total, 0)
  const existing = document.getElementById('naplataModal')
  if (existing) existing.remove()
  const modal = document.createElement('div')
  modal.id = 'naplataModal'
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;'
  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="width:560px;max-height:90vh;overflow-y:auto;border-radius:20px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;background:#16213e;border-radius:20px 20px 0 0;">
        <h3 style="font-size:20px;font-weight:700;">${isPodelba ? '🔀 Подели нарачка' : '💰 Наплата'}</h3>
        <button onclick="closeNaplataModal()" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;color:white;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div style="padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.08);background:#0f172a;">
        <p style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">${isPodelba ? 'Кликни за да избереш артикли:' : 'Нарачани артикли'}</p>
        ${items.map(item => `
          <div ${isPodelba ? `onclick="togglePodelbaItem('${item.key}')"` : ''} id="pitem-${item.key.replace(/[^a-z0-9]/gi, '_')}" style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 14px;border-radius:10px;margin-bottom:6px;cursor:${isPodelba ? 'pointer' : 'default'};background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);">
            <div>
              <p style="font-size:14px;font-weight:600;">${item.quantity}x ${item.name}</p>
              ${item.notes ? `<p style="font-size:11px;color:rgba(255,255,255,0.4);">${item.notes}</p>` : ''}
              ${isPodelba ? `<p style="font-size:12px;color:#ff8030;">${item.unit_price} ден/парче</p>` : ''}
            </div>
            <div style="text-align:right;">
              ${isPodelba ? `<p style="font-size:14px;font-weight:700;color:#4ade80;" id="psel-${item.key.replace(/[^a-z0-9]/gi, '_')}">0 избрано</p>` : ''}
              <p style="font-size:14px;font-weight:700;color:#ff8030;">${item.total} ден</p>
            </div>
          </div>`).join('')}
      </div>
      <div style="padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;background:#0f172a;">
        <span style="font-size:16px;font-weight:700;">${isPodelba ? 'Избрано:' : 'Вкупно:'}</span>
        <span style="font-size:24px;font-weight:900;color:#ff8030;" id="naplataTotal">${isPodelba ? '0' : total} ден</span>
      </div>
      <div style="padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.08);background:#16213e;">
        <p style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Начин на плаќање</p>
        <div style="display:flex;gap:10px;">
          ${['ГОТОВИНА', 'КАРТИЧКА', 'ИНТЕРНО'].map(type => `<button onclick="selectPayType('${type}')" id="paytype-${type}" style="flex:1;padding:12px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid ${type === 'ГОТОВИНА' ? 'transparent' : 'rgba(255,255,255,0.1)'};background:${type === 'ГОТОВИНА' ? 'linear-gradient(135deg,#ff5500,#ff9000)' : 'rgba(255,255,255,0.07)'};color:white;font-family:'Segoe UI',sans-serif;">${type === 'ГОТОВИНА' ? '💵' : type === 'КАРТИЧКА' ? '💳' : '🏠'} ${type}</button>`).join('')}
        </div>
      </div>
      <div id="gotovinaSection" style="padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.08);background:#16213e;">
        <p style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Примени пари</p>
        <input type="number" id="primieniPari" placeholder="0" oninput="presmetajResto()" style="width:100%;padding:12px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:18px;outline:none;font-family:'Segoe UI',sans-serif;margin-bottom:12px;" />
        <div style="display:flex;justify-content:space-between;padding:12px 16px;border-radius:12px;background:rgba(0,180,216,0.1);border:1px solid rgba(0,180,216,0.2);">
          <span style="font-size:15px;font-weight:600;">Ресто:</span>
          <span style="font-size:20px;font-weight:900;color:#00B4D8;" id="restoAmount">0 ден</span>
        </div>
      </div>
      <div style="padding:16px 24px;display:flex;flex-direction:column;gap:10px;background:#16213e;border-radius:0 0 20px 20px;">
        ${!isPodelba && items.reduce((s, i) => s + i.quantity, 0) > 1 ? `<button onclick="startPodelba()" style="width:100%;padding:12px;border-radius:12px;background:rgba(168,85,247,0.2);color:#D8B4FE;border:1px solid rgba(168,85,247,0.3);font-weight:600;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">🔀 Подели нарачка</button>` : ''}
        ${isPodelba ? `
          <button onclick="naplatiPodelba()" style="width:100%;padding:16px;border-radius:14px;background:linear-gradient(135deg,#7C3AED,#A855F7);color:white;border:none;font-weight:700;font-size:16px;cursor:pointer;font-family:'Segoe UI',sans-serif;">💰 Наплати избрани</button>
          <button onclick="renderNaplataModal(false)" style="width:100%;padding:12px;border-radius:12px;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.1);font-weight:600;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">← Назад</button>
        ` : `<button onclick="finishNaplata()" style="width:100%;padding:16px;border-radius:14px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:16px;cursor:pointer;font-family:'Segoe UI',sans-serif;box-shadow:0 4px 20px rgba(255,100,0,0.3);">✅ Наплати ${total} ден</button>`}
      </div>
    </div>`
  document.body.appendChild(modal)
  window._naplataState.isPodelba = isPodelba
  window._naplataState.selectedPodelba = {}
  const internoBtn = document.getElementById('paytype-ИНТЕРНО')
if (internoBtn) internoBtn.style.display = window._internoVisible ? 'block' : 'none'
}

function closeNaplataModal() {
  const modal = document.getElementById('naplataModal')
  if (modal) modal.remove()
  window._naplataState = null
  if (currentTab === 'pos') updateCartDisplay()
}

function selectPayType(type) {
  window._naplataState.payType = type
    ;['ГОТОВИНА', 'КАРТИЧКА', 'ИНТЕРНО'].forEach(t => {
      const btn = document.getElementById(`paytype-${t}`)
      if (btn) { btn.style.background = t === type ? 'linear-gradient(135deg,#ff5500,#ff9000)' : 'rgba(255,255,255,0.07)'; btn.style.borderColor = t === type ? 'transparent' : 'rgba(255,255,255,0.1)' }
    })
  const gotovinaSection = document.getElementById('gotovinaSection')
  if (gotovinaSection) gotovinaSection.style.display = type === 'КАРТИЧКА' ? 'none' : 'block'
  const primieniEl = document.getElementById('primieniPari')
  const restoEl = document.getElementById('restoAmount')
  if (primieniEl) primieniEl.value = ''
  if (restoEl) { restoEl.textContent = '0 ден'; restoEl.style.color = '#00B4D8' }
}

function presmetajResto() {
  const state = window._naplataState
  const primeni = parseFloat(document.getElementById('primieniPari').value) || 0
  const total = state.isPodelba ? (state.currentPodelbaTotal || 0) : state.remainingItems.reduce((s, i) => s + i.total, 0)
  const resto = primeni - total
  const restoEl = document.getElementById('restoAmount')
  if (restoEl) {
    if (primeni === 0) { restoEl.textContent = '0 ден'; restoEl.style.color = '#00B4D8' }
    else if (resto >= 0) { restoEl.textContent = resto + ' ден'; restoEl.style.color = '#4ade80' }
    else { restoEl.textContent = Math.abs(resto) + ' ден (недостасува)'; restoEl.style.color = '#FCA5A5' }
  }
}

function startPodelba() { window._naplataState.selectedPodelba = {}; renderNaplataModal(true) }

function togglePodelbaItem(key) {
  const state = window._naplataState
  const item = state.remainingItems.find(i => i.key === key)
  if (!item) return
  if (!state.selectedPodelba[key]) state.selectedPodelba[key] = 0
  if (state.selectedPodelba[key] < item.quantity) state.selectedPodelba[key]++
  else state.selectedPodelba[key] = 0
  const safeKey = key.replace(/[^a-z0-9]/gi, '_')
  const selEl = document.getElementById(`psel-${safeKey}`)
  const row = document.getElementById(`pitem-${safeKey}`)
  if (selEl) selEl.textContent = state.selectedPodelba[key] > 0 ? `${state.selectedPodelba[key]} избрано` : '0 избрано'
  if (row) row.style.background = state.selectedPodelba[key] > 0 ? 'rgba(0,180,216,0.1)' : 'rgba(255,255,255,0.05)'
  const selTotal = Object.entries(state.selectedPodelba).reduce((s, [k, qty]) => { const it = state.remainingItems.find(i => i.key === k); return s + (it ? it.unit_price * qty : 0) }, 0)
  const totalEl = document.getElementById('naplataTotal')
  if (totalEl) totalEl.textContent = selTotal + ' ден'
  state.currentPodelbaTotal = selTotal
  const primieniEl = document.getElementById('primieniPari')
  const restoEl = document.getElementById('restoAmount')
  if (primieniEl) primieniEl.value = ''
  if (restoEl) { restoEl.textContent = '0 ден'; restoEl.style.color = '#00B4D8' }
}

// FIX #5 — status: 'ДОСТАВЕНА' наместо 'НОВА' за платени нарачки од POS
async function naplatiPodelba() {
  const state = window._naplataState
  const selected = state.selectedPodelba
  const selTotal = state.currentPodelbaTotal || 0
  if (selTotal === 0) { showMsg('❌ Избери артикли!'); return }
  if (state.fromPOS) {
    Object.entries(selected).forEach(([k, qty]) => {
      const cartItem = cart.find(i => (i.id + '|' + (i.notes || '')) === k)
      if (cartItem) {
        if (qty < cartItem.qty) { cartItem.qty -= qty; cart.push({ ...cartItem, qty: qty, paid: true, paidQty: qty }) }
        else { cartItem.paid = true; cartItem.paidQty = qty }
      }
    })
    const selectedItems = Object.entries(selected).filter(([k, qty]) => qty > 0).map(([k, qty]) => { const item = state.remainingItems.find(i => i.key === k); return { ...item, qty } }).filter(Boolean)
    const { data: order, error } = await supabase.from('orders').insert({
      restaurant_id: currentRestaurant.id, table_id: state.tableId, status: 'ДОСТАВЕНА', total_amount: selTotal, payment_status: 'ПЛАТЕНО', payment_type: state.payType
    }).select().single()
    if (error) { showMsg('❌ ' + error.message); return }
    await supabase.from('order_items').insert(selectedItems.map(item => ({
      order_id: order.id, menu_item_id: item.menu_item_id, quantity: item.qty, unit_price: item.unit_price, notes: item.notes || null, payment_status: 'ПЛАТЕНО'
    })))
  } else {
    const selectedItemIds = Object.entries(selected).filter(([k, qty]) => qty > 0).map(([k]) => { const item = state.remainingItems.find(i => i.key === k); return item?.id }).filter(Boolean)
    if (selectedItemIds.length > 0) await supabase.from('order_items').update({ payment_status: 'ПЛАТЕНО' }).in('id', selectedItemIds)
  }
  Object.entries(selected).forEach(([k, qty]) => {
    const item = state.remainingItems.find(i => i.key === k)
    if (item) { item.quantity -= qty; item.total = item.unit_price * item.quantity }
  })
  state.remainingItems = state.remainingItems.filter(i => i.quantity > 0)
  state.selectedPodelba = {}
  state.currentPodelbaTotal = 0
  state.isPodelba = false
  showMsg(`✅ Наплатено ${selTotal} ден!`, 'success')
  if (state.remainingItems.length === 0) await finishNaplata()
  else renderNaplataModal(false)
}

async function finishNaplata() {
  const state = window._naplataState
  const { payType, tableId } = state
  if (state.fromPOS) {
    const total = state.remainingItems.reduce((s, i) => s + i.total, 0)
    const allPrintItems = state.remainingItems.length > 0 ? (state.fullCartSnapshot || state.cartSnapshot) : []
    const fullTotal = state.remainingItems.reduce((s, i) => s + i.total, 0)
    if (fullTotal > 0) {
      const { data: order, error } = await supabase.from('orders').insert({
        restaurant_id: currentRestaurant.id, table_id: tableId, status: 'НОВА', total_amount: fullTotal, payment_status: 'ПЛАТЕНО', payment_type: payType
      }).select().single()
      if (error) { showMsg('❌ ' + error.message); return }
      await supabase.from('order_items').insert(allPrintItems.map(item => ({
        order_id: order.id, menu_item_id: item.id || item.menu_item_id, quantity: item.qty || item.quantity, unit_price: item.price || item.unit_price, notes: item.notes || null, payment_status: 'ПЛАТЕНО'
      })))
    }
    await supabase.from('tables').update({ status: 'ЗАФАТЕНА' }).eq('id', tableId)
    tableCarts[tableId] = []
    cart = []
    currentTable = null
    try {
      const { ipcRenderer } = require('electron')
      await ipcRenderer.invoke('print-kitchen', {
        tableNumber: tables.find(t => t.id === tableId)?.table_number || '-',
        orderNumber: orderCounter, time: new Date().toLocaleTimeString('mk-MK'),
        restaurantName: currentRestaurant.name,
        items: (state.fullCartSnapshot || state.cartSnapshot).map(item => ({ quantity: item.qty, name: item.name, notes: item.notes || '' }))
      })
    } catch (e) { console.log('Принтер:', e.message) }
  } else {
    // FIX #3 — провери дали има уште активни нарачки пред да ја ослободи масата
    await supabase.from('orders').update({ payment_status: 'ПЛАТЕНО', status: 'ДОСТАВЕНА', payment_type: payType }).in('id', state.orderIds)
    const { data: activeOrders } = await supabase.from('orders')
      .select('id').eq('table_id', tableId).neq('status', 'ДОСТАВЕНА')
    if (!activeOrders || activeOrders.length === 0) {
      await supabase.from('tables').update({ status: 'СЛОБОДНА' }).eq('id', tableId)
    }
  }
  await loadData()
  try {
    const { ipcRenderer } = require('electron')
    const printItems = state.fromPOS
      ? state.cartSnapshot.map(item => ({ quantity: item.qty, name: item.name, notes: item.notes || '', price: item.price, total: item.price * item.qty }))
      : state.allItems.map(item => ({ quantity: item.quantity, name: item.name, notes: item.notes || '', price: item.unit_price, total: item.total }))
    await ipcRenderer.invoke('print-receipt', {
      tableNumber: tables.find(t => t.id === state.tableId)?.table_number || '-',
      orderNumber: orderCounter, time: new Date().toLocaleTimeString('mk-MK'),
      restaurantName: currentRestaurant.name, items: printItems, total: state.total, payType: state.payType
    })
  } catch (e) { console.log('Принтер:', e.message) }
  closeNaplataModal()
  showMsg('✅ Наплатено успешно!', 'success')
  if (state.fromPOS) renderPOS()
  else renderKitchen()
}


function openTimerModal(orderId) {
  const modal = document.createElement('div')
  modal.id = 'timerModal'
  modal.style.cssText = 'position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;'
  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="width:360px;border-radius:20px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <h3 style="font-size:18px;font-weight:700;color:white;margin-bottom:8px;text-align:center;">⏱️ Колку време треба?</h3>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;margin-bottom:20px;">Избери времетраење за подготовка</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
        ${[5, 10, 15, 20, 25, 30, 35, 40].map(min => `
          <button onclick="acceptWithTimer('${orderId}', ${min})" style="padding:14px 8px;border-radius:12px;background:linear-gradient(135deg,#1565C0,#00B4D8);color:white;border:none;font-weight:700;font-size:15px;cursor:pointer;font-family:'Segoe UI',sans-serif;">${min}<span style="font-size:10px;display:block;font-weight:400;">мин</span></button>
        `).join('')}
      </div>
    </div>`
  modal.onclick = () => modal.remove()
  document.body.appendChild(modal)
}

async function acceptWithTimer(orderId, minutes) {
  const modal = document.getElementById('timerModal')
  if (modal) modal.remove()
  const readyAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  await supabase.from('orders').update({ status: 'ВО ПОДГОТОВКА', ready_at: readyAt }).eq('id', orderId)
  renderKitchen(true)
}

function startKitchenTimers(orders) {
  if (kitchenTimerInterval) clearInterval(kitchenTimerInterval)
  if (!orders || orders.length === 0) return
  const tick = () => {
    const now = Date.now()
    orders.forEach(order => {
      if (!order.ready_at || order.status !== 'ВО ПОДГОТОВКА') return
      const timerEl = document.getElementById('timer-' + order.id)
      if (!timerEl) return
      const diff = new Date(order.ready_at).getTime() - now
      if (diff <= 0) {
        timerEl.textContent = '✅ Готово!'
        timerEl.style.color = '#4ade80'
        clearInterval(kitchenTimerInterval)
        kitchenTimerInterval = null
        supabase.from('orders').update({ status: 'ГОТОВА' }).eq('id', order.id).then(() => renderKitchen(true))
      } else {
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        timerEl.textContent = '⏱️ ' + mins + ':' + String(secs).padStart(2, '0')
        timerEl.style.color = diff < 60000 ? '#FCA5A5' : diff < 180000 ? '#FDE047' : '#90E0EF'
      }
    })
  }
  tick()
  kitchenTimerInterval = setInterval(tick, 1000)
}
function switchOrdersDate(date) {
  window._ordersSelectedDate = date
  loadOrdersAdmin()
}
window.switchOrdersDate = switchOrdersDate

function startListening() {
  supabase.channel('staff-orders-' + currentRestaurant.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${currentRestaurant.id}` }, () => {
      if (currentTab === 'kitchen') renderKitchen(true)
      document.getElementById('kitchenBadge').style.display = 'flex'
      const ctx = new AudioContext()
      const notes = [523, 659, 784]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15)
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3)
        osc.start(ctx.currentTime + i * 0.15)
        osc.stop(ctx.currentTime + i * 0.15 + 0.3)
      })
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${currentRestaurant.id}` }, () => { if (currentTab === 'kitchen') renderKitchen(true) })
    .subscribe()
}

function showAdminPin() {
  const content = document.getElementById('contentArea')
  document.getElementById('posTab').classList.remove('active')
  document.getElementById('kitchenTab').classList.remove('active')
  document.getElementById('adminTab').classList.add('active')
  supabase.from('profiles').select('admin_pin').eq('id', currentUser.id).single().then(({ data }) => {
    if (!data?.admin_pin) {
      content.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;"><div style="width:340px;padding:40px;border-radius:24px;background:#16213e;border:1px solid rgba(255,255,255,0.12);text-align:center;"><div style="font-size:48px;margin-bottom:16px;">🔐</div><h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Создај Admin PIN</h2><p style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:24px;">Внеси 4-цифрен PIN</p><input type="password" id="newPin" maxlength="4" placeholder="••••" style="width:100%;padding:16px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:24px;text-align:center;outline:none;letter-spacing:8px;margin-bottom:12px;font-family:'Segoe UI',sans-serif;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" /><input type="password" id="confirmPin" maxlength="4" placeholder="••••" style="width:100%;padding:16px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:24px;text-align:center;outline:none;letter-spacing:8px;margin-bottom:20px;font-family:'Segoe UI',sans-serif;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" /><div id="pinError" style="color:#FCA5A5;font-size:13px;margin-bottom:12px;min-height:20px;"></div><button onclick="createPin()" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:15px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Создај PIN</button><button onclick="renderPOS()" style="width:100%;padding:12px;border-radius:12px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.1);font-weight:600;font-size:13px;cursor:pointer;margin-top:10px;font-family:'Segoe UI',sans-serif;">← Откажи</button></div></div>`
      setTimeout(() => document.getElementById('newPin')?.focus(), 100)
    } else {
      content.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;"><div style="width:340px;padding:40px;border-radius:24px;background:#16213e;border:1px solid rgba(255,255,255,0.12);text-align:center;"><div style="font-size:48px;margin-bottom:16px;">🔐</div><h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Admin PIN</h2><p style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:24px;">Внеси го твојот 4-цифрен PIN</p><input type="password" id="enterPin" maxlength="4" placeholder="••••" style="width:100%;padding:16px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:24px;text-align:center;outline:none;letter-spacing:8px;margin-bottom:20px;font-family:'Segoe UI',sans-serif;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onkeydown="if(event.key==='Enter') verifyPin()" /><div id="pinError" style="color:#FCA5A5;font-size:13px;margin-bottom:12px;min-height:20px;"></div><button onclick="verifyPin()" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:15px;cursor:pointer;font-family:'Segoe UI',sans-serif;">🔑 Влези</button><button onclick="renderPOS()" style="width:100%;padding:12px;border-radius:12px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.1);font-weight:600;font-size:13px;cursor:pointer;margin-top:10px;font-family:'Segoe UI',sans-serif;">← Откажи</button></div></div>`
      setTimeout(() => document.getElementById('enterPin')?.focus(), 100)
    }
  })
}

function showSetPin2() {
  const modal = document.createElement('div')
  modal.id = 'pin2Modal'
  modal.style.cssText = 'position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;'
  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="width:340px;padding:40px;border-radius:24px;background:#16213e;border:1px solid rgba(255,255,255,0.12);text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">🔐</div>
      <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;color:white;">Втор Admin PIN</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:24px;">Внеси нов 4-цифрен PIN</p>
      <input type="password" id="newPin2" maxlength="4" placeholder="••••" style="width:100%;padding:16px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:24px;text-align:center;outline:none;letter-spacing:8px;margin-bottom:12px;font-family:'Segoe UI',sans-serif;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" />
      <input type="password" id="confirmPin2" maxlength="4" placeholder="••••" style="width:100%;padding:16px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:24px;text-align:center;outline:none;letter-spacing:8px;margin-bottom:20px;font-family:'Segoe UI',sans-serif;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" />
      <div id="pin2Error" style="color:#FCA5A5;font-size:13px;margin-bottom:12px;min-height:20px;"></div>
      <button onclick="savePin2()" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:15px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Зачувај PIN</button>
      <button onclick="document.getElementById('pin2Modal').remove()" style="width:100%;padding:12px;border-radius:12px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.1);font-weight:600;font-size:13px;cursor:pointer;margin-top:10px;font-family:'Segoe UI',sans-serif;">← Откажи</button>
    </div>`
  modal.onclick = () => modal.remove()
  document.body.appendChild(modal)
  setTimeout(() => document.getElementById('newPin2')?.focus(), 100)
}

async function savePin2() {
  const newPin2 = document.getElementById('newPin2').value
  const confirmPin2 = document.getElementById('confirmPin2').value
  const pin2Error = document.getElementById('pin2Error')
  if (newPin2.length !== 4) { pin2Error.textContent = '❌ PIN мора да биде 4 цифри!'; return }
  if (newPin2 !== confirmPin2) { pin2Error.textContent = '❌ PIN-овите не се совпаѓаат!'; return }
  await supabase.from('profiles').update({ admin_pin2: newPin2 }).eq('id', currentUser.id)
  document.getElementById('pin2Modal').remove()
  showMsg('✅ Вториот PIN е зачуван!', 'success')
}

async function createPin() {
  const newPin = document.getElementById('newPin').value
  const confirmPin = document.getElementById('confirmPin').value
  const pinError = document.getElementById('pinError')
  if (newPin.length !== 4) { pinError.textContent = '❌ PIN мора да биде 4 цифри!'; return }
  if (newPin !== confirmPin) { pinError.textContent = '❌ PIN-овите не се совпаѓаат!'; return }
  await supabase.from('profiles').update({ admin_pin: newPin }).eq('id', currentUser.id)
  showMsg('✅ PIN е создаден!', 'success')
  renderAdmin()
}

async function verifyPin() {
  const enterPin = document.getElementById('enterPin').value
  const pinError = document.getElementById('pinError')
  const { data } = await supabase.from('profiles').select('admin_pin, admin_pin2').eq('id', currentUser.id).single()
  if (enterPin !== data?.admin_pin && enterPin !== data?.admin_pin2) { pinError.textContent = '❌ Погрешен PIN!'; document.getElementById('enterPin').value = ''; return }
  if (enterPin === data?.admin_pin2) renderAdmin2()
  else renderAdmin()
}

async function renderAdmin2() {
  const content = document.getElementById('contentArea')
  document.getElementById('posTab').classList.remove('active')
  document.getElementById('kitchenTab').classList.remove('active')
  document.getElementById('adminTab').classList.add('active')
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  window._admin2Date = window._admin2Date || today
  const selDate = window._admin2Date
  const { data: orders } = await supabase.from('orders')
    .select('total_amount, payment_type, payment_status')
    .eq('restaurant_id', currentRestaurant.id)
    .eq('payment_status', 'ПЛАТЕНО')
    .eq('payment_type', 'ИНТЕРНО')
    .gte('created_at', selDate + 'T00:00:00')
    .lte('created_at', selDate + 'T23:59:59')
  const interno = (orders || []).reduce((s, o) => s + o.total_amount, 0)
  content.innerHTML = `
    <div style="max-width:800px;padding:20px;">
      <h3 style="font-size:18px;font-weight:700;margin-bottom:20px;">🏠 Интерно</h3>
      <div style="display:flex;gap:10px;margin-bottom:20px;">
        <button onclick="switchAdmin2Date('${today}')" style="padding:8px 16px;border-radius:10px;background:${selDate===today?'linear-gradient(135deg,#ff5500,#ff9000)':'rgba(255,255,255,0.08)'};color:white;border:none;cursor:pointer;font-weight:600;font-size:13px;font-family:'Segoe UI',sans-serif;">📅 Денес</button>
        <button onclick="switchAdmin2Date('${yesterday}')" style="padding:8px 16px;border-radius:10px;background:${selDate===yesterday?'linear-gradient(135deg,#ff5500,#ff9000)':'rgba(255,255,255,0.08)'};color:white;border:none;cursor:pointer;font-weight:600;font-size:13px;font-family:'Segoe UI',sans-serif;">📅 Вчера</button>
      </div>
      <div style="padding:24px;border-radius:16px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.3);">
        <p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🏠 Интерно</p>
        <p style="font-size:36px;font-weight:900;color:#D8B4FE;">${interno} ден</p>
      </div>
    </div>`
}

function toggleInternoBtn() {
  window._internoVisible = !window._internoVisible
  const btn = document.getElementById('paytype-ИНТЕРНО')
  if (btn) btn.style.display = window._internoVisible ? 'block' : 'none'
  document.querySelectorAll('[data-interno="true"]').forEach(el => {
    el.style.display = window._internoVisible ? '' : 'none'
  })
}
window.toggleInternoBtn = toggleInternoBtn

function showTableQR(tableId, tableNumber) {
  const url = `https://restaurant-platform-navy.vercel.app/table/${tableId}`
  const QRCode = require('qrcode')
  const modal = document.createElement('div')
  modal.id = 'qrModal'
  modal.style.cssText = 'position:fixed;inset:0;z-index:700;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;'
  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="width:340px;padding:32px;border-radius:24px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);text-align:center;">
      <h3 style="font-size:18px;font-weight:700;color:white;margin-bottom:4px;">📱 QR Код</h3>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:20px;">Маса ${tableNumber}</p>
      <canvas id="qrCanvas" style="border-radius:12px;"></canvas>
      <p style="color:rgba(255,255,255,0.3);font-size:11px;margin-top:12px;word-break:break-all;">${url}</p>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button onclick="downloadQR(${tableNumber})" style="flex:1;padding:10px;border-radius:10px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:600;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">📥 Преземи</button>
        <button onclick="document.getElementById('qrModal').remove()" style="flex:1;padding:10px;border-radius:10px;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.2);font-weight:600;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✕ Затвори</button>
      </div>
    </div>`
  modal.onclick = () => modal.remove()
  document.body.appendChild(modal)
  QRCode.toCanvas(document.getElementById('qrCanvas'), url, { width: 260, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
}
window.showTableQR = showTableQR

function downloadQR(tableNumber) {
  const canvas = document.getElementById('qrCanvas')
  const link = document.createElement('a')
  link.download = `masa-${tableNumber}-qr.png`
  link.href = canvas.toDataURL()
  link.click()
}
window.downloadQR = downloadQR

function switchAdmin2Date(date) {
  window._admin2Date = date
  renderAdmin2()
}
window.switchAdmin2Date = switchAdmin2Date
window.renderAdmin2 = renderAdmin2

async function renderAdmin() {
  const content = document.getElementById('contentArea')
  document.getElementById('posTab').classList.remove('active')
  document.getElementById('kitchenTab').classList.remove('active')
  document.getElementById('adminTab').classList.add('active')
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;flex:1;width:100%;min-width:0;">
      <div style="display:flex;gap:6px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.2);overflow-x:auto;flex-shrink:0;">
        ${[{ id: 'menu', label: '🍽️ Мени' }, { id: 'tables', label: '🪑 Маси' }, { id: 'ingredients', label: '🥗 Состојки' }, { id: 'extras', label: '➕ Додатоци' }, { id: 'orders', label: '📊 Нарачки' }, { id: 'promet', label: '💰 Промет' }, { id: 'restaurant', label: '🏪 Ресторан' }].map(t => `<button onclick="loadAdminTab('${t.id}')" id="atab-${t.id}" style="padding:7px 14px;border-radius:10px;font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;border:none;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.7);font-family:'Segoe UI',sans-serif;">${t.label}</button>`).join('')}
      </div>
      <div style="flex:1;overflow-y:auto;padding:20px;" id="adminContent"></div>
    </div>`
  loadAdminTab('menu')
}

function loadAdminTab(tab) {
  document.querySelectorAll('[id^="atab-"]').forEach(btn => { btn.style.background = 'rgba(255,255,255,0.07)'; btn.style.color = 'rgba(255,255,255,0.7)' })
  const activeBtn = document.getElementById(`atab-${tab}`)
  if (activeBtn) { activeBtn.style.background = 'linear-gradient(135deg,#ff5500,#ff9000)'; activeBtn.style.color = 'white' }
  if (tab === 'menu') loadMenuAdmin()
  else if (tab === 'tables') loadTablesAdmin()
  else if (tab === 'ingredients') loadIngredientsAdmin()
  else if (tab === 'extras') loadExtrasAdmin()
  else if (tab === 'orders') loadOrdersAdmin()
  else if (tab === 'promet') loadPrometAdmin()
  else if (tab === 'restaurant') loadRestaurantAdmin()
}

async function loadMenuAdmin() {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = '<p style="color:#90E0EF;padding:20px;">Се вчитува...</p>'
  const { data: cats } = await supabase.from('menu_categories').select('*, menu_items(*)').eq('restaurant_id', currentRestaurant.id).order('display_order')
  ac.innerHTML = `
    <div style="max-width:900px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="font-size:18px;font-weight:700;">🍽️ Мени</h3>
        <button onclick="showAddCategory()" style="padding:9px 18px;border-radius:10px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:600;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">+ Нова категорија</button>
      </div>
      ${!cats || cats.length === 0 ? `<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);"><p style="font-size:32px;margin-bottom:12px;">🍽️</p><p>Нема категории. Додај нова!</p></div>` :
      cats.map(cat => `
          <div style="margin-bottom:20px;border-radius:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
            <div style="padding:12px 18px;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-weight:700;font-size:15px;">${cat.name}</span>
              <div style="display:flex;gap:8px;">
                <button onclick="showAddItem('${cat.id}')" style="padding:6px 14px;border-radius:8px;background:linear-gradient(135deg,#1565C0,#00B4D8);color:white;border:none;font-weight:600;font-size:12px;cursor:pointer;font-family:'Segoe UI',sans-serif;">+ Јадење</button>
                <button onclick="deleteCategory('${cat.id}')" style="padding:6px 12px;border-radius:8px;background:rgba(220,38,38,0.2);color:#FCA5A5;border:1px solid rgba(220,38,38,0.3);font-size:12px;cursor:pointer;">🗑️</button>
              </div>
            </div>
            <div style="padding:12px 18px;">
              ${!cat.menu_items || cat.menu_items.length === 0 ? `<p style="color:rgba(255,255,255,0.3);font-size:13px;">Нема јадења</p>` :
          cat.menu_items.map(item => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="display:flex;align-items:center;gap:12px;">
                      ${item.image_url ? `<img src="${item.image_url}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;" />` : '<div style="width:40px;height:40px;border-radius:8px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;">🍽️</div>'}
                      <div><p style="font-weight:600;font-size:14px;">${item.name}</p><p style="color:rgba(255,255,255,0.4);font-size:12px;">${item.description || ''}</p></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="color:#ff8030;font-weight:700;">${item.price} ден</span>
                      <span style="font-size:11px;padding:3px 8px;border-radius:6px;background:${item.is_available ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.15)'};color:${item.is_available ? '#86EFAC' : '#FCA5A5'};">${item.is_available ? 'Достапно' : 'Недостапно'}</span>
                      <button onclick="openItemPrilozi('${item.id}', '${item.name.replace(/'/g, "\\'")}')" style="padding:5px 10px;border-radius:7px;background:rgba(0,180,216,0.15);color:#00B4D8;border:1px solid rgba(0,180,216,0.3);font-size:11px;cursor:pointer;font-family:'Segoe UI',sans-serif;">⚙️ Прилози</button>
                      <button onclick="toggleItem('${item.id}', ${item.is_available})" style="padding:5px 10px;border-radius:7px;background:rgba(255,255,255,0.07);color:white;border:1px solid rgba(255,255,255,0.15);font-size:11px;cursor:pointer;font-family:'Segoe UI',sans-serif;">${item.is_available ? 'Исклучи' : 'Вклучи'}</button>
                      <button onclick="deleteItem('${item.id}')" style="padding:5px 10px;border-radius:7px;background:rgba(220,38,38,0.15);color:#FCA5A5;border:1px solid rgba(220,38,38,0.3);font-size:11px;cursor:pointer;">🗑️</button>
                    </div>
                  </div>`).join('')}
            </div>
          </div>`).join('')}
    </div>`
}

// FIX #4 — филтрирај по menu_item_id наместо да ги земаш сите
async function openItemPrilozi(itemId, itemName) {
  const { data: allIngs } = await supabase.from('ingredients').select('*').eq('restaurant_id', currentRestaurant.id)
  const { data: allExts } = await supabase.from('extras').select('*').eq('restaurant_id', currentRestaurant.id)
  const { data: linkedIngs } = await supabase.from('item_ingredients').select('ingredient_id').eq('menu_item_id', itemId)
  const { data: linkedExts } = await supabase.from('item_extras').select('extra_id').eq('menu_item_id', itemId)
  const checkedIngIds = new Set((linkedIngs || []).map(i => i.ingredient_id))
  const checkedExtIds = new Set((linkedExts || []).map(e => e.extra_id))
  const modal = document.createElement('div')
  modal.id = 'priloziModal'
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;'
  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="width:500px;max-height:85vh;overflow-y:auto;border-radius:20px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);padding:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="font-size:18px;font-weight:700;">⚙️ Прилози за ${itemName}</h3>
        <button onclick="closePriloziModal()" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;color:white;cursor:pointer;font-size:16px;">✕</button>
      </div>
      ${(allIngs || []).length > 0 ? `<p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🥗 Состојки</p><div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;">${(allIngs || []).map(ing => `<div onclick="togglePriloziIng('${ing.id}', '${itemId}')" id="ping-${ing.id}" style="padding:10px 14px;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:10px;background:${checkedIngIds.has(ing.id) ? 'rgba(0,180,216,0.1)' : 'rgba(255,255,255,0.05)'};border:1px solid ${checkedIngIds.has(ing.id) ? 'rgba(0,180,216,0.3)' : 'rgba(255,255,255,0.1)'};">  <span id="ping-icon-${ing.id}" style="font-size:16px;">${checkedIngIds.has(ing.id) ? '✅' : '⬜'}</span><span style="font-size:14px;">${ing.name}</span></div>`).join('')}</div>` : ''}
      ${(allExts || []).length > 0 ? `<p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">➕ Додатоци</p><div style="display:flex;flex-direction:column;gap:6px;">${(allExts || []).map(ext => `<div onclick="togglePriloziExt('${ext.id}', '${itemId}', ${ext.price})" id="pext-${ext.id}" style="padding:10px 14px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:${checkedExtIds.has(ext.id) ? 'rgba(253,224,71,0.1)' : 'rgba(255,255,255,0.05)'};border:1px solid ${checkedExtIds.has(ext.id) ? 'rgba(253,224,71,0.3)' : 'rgba(255,255,255,0.1)'};">  <div style="display:flex;align-items:center;gap:10px;"><span id="pext-icon-${ext.id}" style="font-size:16px;">${checkedExtIds.has(ext.id) ? '✅' : '⬜'}</span><span style="font-size:14px;">${ext.name}</span></div><span style="color:#FDE047;font-size:13px;font-weight:700;">+${ext.price} ден</span></div>`).join('')}</div>` : ''}
      <button onclick="savePrilozi()" style="width:100%;margin-top:16px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Зачувај прилози</button>
    </div>`
  modal.onclick = closePriloziModal
  document.body.appendChild(modal)
  window._priloziState = { itemId, checkedIngIds, checkedExtIds, allIngs: allIngs || [], allExts: allExts || [] }
}

function togglePriloziIng(ingId, itemId) {
  const state = window._priloziState
  const icon = document.getElementById(`ping-icon-${ingId}`)
  const row = document.getElementById(`ping-${ingId}`)
  if (state.checkedIngIds.has(ingId)) {
    state.checkedIngIds.delete(ingId); icon.textContent = '⬜'; row.style.background = 'rgba(255,255,255,0.05)'; row.style.borderColor = 'rgba(255,255,255,0.1)'
  } else {
    state.checkedIngIds.add(ingId); icon.textContent = '✅'; row.style.background = 'rgba(0,180,216,0.1)'; row.style.borderColor = 'rgba(0,180,216,0.3)'
  }
}

function togglePriloziExt(extId, itemId, price) {
  const state = window._priloziState
  const icon = document.getElementById(`pext-icon-${extId}`)
  const row = document.getElementById(`pext-${extId}`)
  if (state.checkedExtIds.has(extId)) {
    state.checkedExtIds.delete(extId); icon.textContent = '⬜'; row.style.background = 'rgba(255,255,255,0.05)'; row.style.borderColor = 'rgba(255,255,255,0.1)'
  } else {
    state.checkedExtIds.add(extId); icon.textContent = '✅'; row.style.background = 'rgba(253,224,71,0.1)'; row.style.borderColor = 'rgba(253,224,71,0.3)'
  }
}
async function savePrilozi() {
  const state = window._priloziState
  const { itemId, checkedIngIds, checkedExtIds } = state
  await supabase.from('item_ingredients').delete().eq('menu_item_id', itemId)
  await supabase.from('item_extras').delete().eq('menu_item_id', itemId)
  if (checkedIngIds.size > 0) {
    await supabase.from('item_ingredients').insert([...checkedIngIds].map(id => ({ menu_item_id: itemId, ingredient_id: id })))
  }
  if (checkedExtIds.size > 0) {
    await supabase.from('item_extras').insert([...checkedExtIds].map(id => ({ menu_item_id: itemId, extra_id: id })))
  }
  closePriloziModal()
  showMsg('✅ Прилозите се зачувани!', 'success')
}

function closePriloziModal() { const modal = document.getElementById('priloziModal'); if (modal) modal.remove(); window._priloziState = null }

async function showAddCategory() {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = `<div style="max-width:400px;"><div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;"><button onclick="loadMenuAdmin()" style="padding:8px 16px;border-radius:10px;background:rgba(255,255,255,0.07);color:white;border:1px solid rgba(255,255,255,0.15);cursor:pointer;font-size:13px;font-family:'Segoe UI',sans-serif;">← Назад</button><h3 style="font-size:18px;font-weight:700;">+ Нова категорија</h3></div><div style="display:flex;flex-direction:column;gap:14px;">${adminInput('Ime на категорија *', 'catName', 'text', 'пр. Предјадења')}<button onclick="saveNewCategory()" style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Зачувај категорија</button></div></div>`
  setTimeout(() => document.getElementById('catName')?.focus(), 100)
}

async function saveNewCategory() {
  const name = document.getElementById('catName').value.trim()
  if (!name) { showMsg('❌ Внеси ime на категорија!'); return }
  const { error } = await supabase.from('menu_categories').insert({ restaurant_id: currentRestaurant.id, name, is_active: true, display_order: 99 })
  if (error) { showMsg('❌ ' + error.message); return }
  await loadData(); showMsg('✅ Категоријата е зачувана!', 'success'); loadMenuAdmin()
}

async function deleteCategory(id) {
  const { error } = await supabase.from('menu_categories').delete().eq('id', id)
  if (error) { showMsg('❌ ' + error.message); return }
  await loadData(); showMsg('✅ Избришано!', 'success'); loadMenuAdmin()
}

async function showAddItem(categoryId) {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = `<div style="max-width:500px;"><div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;"><button onclick="loadMenuAdmin()" style="padding:8px 16px;border-radius:10px;background:rgba(255,255,255,0.07);color:white;border:1px solid rgba(255,255,255,0.15);cursor:pointer;font-size:13px;font-family:'Segoe UI',sans-serif;">← Назад</button><h3 style="font-size:18px;font-weight:700;">+ Ново јадење</h3></div><div style="display:flex;flex-direction:column;gap:14px;">${adminInput('Ime на јадење *', 'itemName', 'text', 'пр. Шопска салата')}${adminInput('Опис', 'itemDesc', 'text', 'пр. Свеж зеленчук...')}${adminInput('Цена (ден) *', 'itemPrice', 'number', '0')}${adminInput('URL на слика', 'itemImage', 'text', 'https://...')}<button onclick="saveNewItem('${categoryId}')" style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Зачувај јадење</button></div></div>`
  setTimeout(() => document.getElementById('itemName')?.focus(), 100)
}

async function saveNewItem(categoryId) {
  const name = document.getElementById('itemName').value.trim()
  const desc = document.getElementById('itemDesc').value.trim()
  const price = parseFloat(document.getElementById('itemPrice').value)
  const image = document.getElementById('itemImage').value.trim()
  if (!name || !price) { showMsg('❌ Пополни го името и цената!'); return }
  const { error } = await supabase.from('menu_items').insert({ category_id: categoryId, name, description: desc || null, price, image_url: image || null, is_available: true })
  if (error) { showMsg('❌ ' + error.message); return }
  await loadData(); showMsg('✅ Јадењето е зачувано!', 'success'); loadMenuAdmin()
}

async function toggleItem(id, current) { await supabase.from('menu_items').update({ is_available: !current }).eq('id', id); loadMenuAdmin() }

async function deleteItem(id) {
  const { error } = await supabase.from('menu_items').delete().eq('id', id)
  if (error) { showMsg('❌ ' + error.message); return }
  await loadData(); showMsg('✅ Избришано!', 'success'); loadMenuAdmin()
}

async function loadTablesAdmin() {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = '<p style="color:#90E0EF;padding:20px;">Се вчитува...</p>'
  const { data: t } = await supabase.from('tables').select('*').eq('restaurant_id', currentRestaurant.id).order('table_number')
  ac.innerHTML = `<div style="max-width:700px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h3 style="font-size:18px;font-weight:700;">🪑 Маси</h3><button onclick="addTable()" style="padding:9px 18px;border-radius:10px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:600;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">+ Додај маса</button></div>${!t || t.length === 0 ? `<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);"><p style="font-size:32px;margin-bottom:12px;">🪑</p><p>Нема маси. Додај!</p></div>` : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;">${t.map(table => `<div style="padding:16px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);text-align:center;"><p style="font-size:28px;font-weight:900;margin-bottom:4px;">${table.table_number}</p><p style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:4px;">Капацитет: ${table.capacity || '-'}</p><p style="font-size:11px;padding:3px 8px;border-radius:6px;display:inline-block;margin-bottom:10px;background:${table.status === 'ЗАФАТЕНА' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)'};color:${table.status === 'ЗАФАТЕНА' ? '#86EFAC' : 'rgba(255,255,255,0.5)'};">${table.status || 'СЛОБОДНА'}</p><button onclick="showTableQR('${table.id}', ${table.table_number})" style="display:block;width:100%;padding:6px;border-radius:8px;background:rgba(0,180,216,0.15);color:#00B4D8;border:1px solid rgba(0,180,216,0.3);font-size:12px;cursor:pointer;font-family:'Segoe UI',sans-serif;margin-bottom:6px;">📱 QR Код</button>
<button onclick="deleteTable('${table.id}')" style="display:block;width:100%;padding:6px;border-radius:8px;background:rgba(220,38,38,0.15);color:#FCA5A5;border:1px solid rgba(220,38,38,0.3);font-size:12px;cursor:pointer;font-family:'Segoe UI',sans-serif;">🗑️ Избриши</button></div>`).join('')}</div>`}</div>`
}

async function addTable() {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = `<div style="max-width:400px;"><div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;"><button onclick="loadTablesAdmin()" style="padding:8px 16px;border-radius:10px;background:rgba(255,255,255,0.07);color:white;border:1px solid rgba(255,255,255,0.15);cursor:pointer;font-size:13px;font-family:'Segoe UI',sans-serif;">← Назад</button><h3 style="font-size:18px;font-weight:700;">+ Нова маса</h3></div><div style="display:flex;flex-direction:column;gap:14px;">${adminInput('Број на маса *', 'tableNum', 'number', 'пр. 1')}${adminInput('Капацитет (лица)', 'tableCap', 'number', 'пр. 4')}<button onclick="saveNewTable()" style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">✅ Зачувај маса</button></div></div>`
  setTimeout(() => document.getElementById('tableNum')?.focus(), 100)
}

async function saveNewTable() {
  const num = document.getElementById('tableNum').value
  const cap = document.getElementById('tableCap').value || '4'
  if (!num) { showMsg('❌ Внеси број на маса!'); return }
  const { error } = await supabase.from('tables').insert({ restaurant_id: currentRestaurant.id, table_number: parseInt(num), capacity: parseInt(cap), status: 'СЛОБОДНА' })
  if (error) { showMsg('❌ ' + error.message); return }
  await loadData(); showMsg('✅ Масата е зачувана!', 'success'); loadTablesAdmin()
}

async function deleteTable(id) {
  const { error } = await supabase.from('tables').delete().eq('id', id)
  if (error) { showMsg('❌ ' + error.message); return }
  await loadData(); showMsg('✅ Масата е избришана!', 'success'); loadTablesAdmin()
}

async function loadIngredientsAdmin() {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = '<p style="color:#90E0EF;padding:20px;">Се вчитува...</p>'
  const { data: ings } = await supabase.from('ingredients').select('*').eq('restaurant_id', currentRestaurant.id)
  ac.innerHTML = `<div style="max-width:700px;"><h3 style="font-size:18px;font-weight:700;margin-bottom:16px;">🥗 Состојки</h3><div style="display:flex;gap:8px;margin-bottom:16px;"><input type="text" id="ingName" placeholder="Ime на состојка" style="flex:1;padding:12px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:14px;outline:none;font-family:'Segoe UI',sans-serif;" /><button onclick="addIngredient()" style="padding:12px 20px;border-radius:10px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:600;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">+ Додај</button></div><div>${(ings || []).map(ing => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);margin-bottom:6px;"><span style="font-size:14px;font-weight:600;">${ing.name}</span><button onclick="deleteIngredient('${ing.id}')" style="padding:5px 10px;border-radius:7px;background:rgba(220,38,38,0.15);color:#FCA5A5;border:1px solid rgba(220,38,38,0.3);font-size:11px;cursor:pointer;">🗑️</button></div>`).join('')}</div></div>`
}

async function addIngredient() {
  const name = document.getElementById('ingName').value.trim()
  if (!name) { showMsg('❌ Внеси состојка!'); return }
  const { error } = await supabase.from('ingredients').insert({ name, restaurant_id: currentRestaurant.id })
  if (error) { showMsg('❌ ' + error.message); return }
  showMsg('✅ Состојката е додадена!', 'success'); loadIngredientsAdmin()
}

async function deleteIngredient(id) { await supabase.from('ingredients').delete().eq('id', id); showMsg('✅ Избришано!', 'success'); loadIngredientsAdmin() }

async function loadExtrasAdmin() {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = '<p style="color:#90E0EF;padding:20px;">Се вчитува...</p>'
  const { data: extras } = await supabase.from('extras').select('*').eq('restaurant_id', currentRestaurant.id)
  ac.innerHTML = `<div style="max-width:700px;"><h3 style="font-size:18px;font-weight:700;margin-bottom:16px;">➕ Додатоци</h3><div style="display:flex;gap:8px;margin-bottom:16px;"><input type="text" id="extName" placeholder="Ime на додаток" style="flex:1;padding:12px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:14px;outline:none;font-family:'Segoe UI',sans-serif;" /><input type="number" id="extPrice" placeholder="Цена" style="width:100px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:14px;outline:none;font-family:'Segoe UI',sans-serif;" /><button onclick="addExtra()" style="padding:12px 20px;border-radius:10px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:600;font-size:13px;cursor:pointer;font-family:'Segoe UI',sans-serif;">+ Додај</button></div><div>${(extras || []).map(ext => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);margin-bottom:6px;"><div><span style="font-size:14px;font-weight:600;">${ext.name}</span><span style="color:#ff8030;font-size:13px;margin-left:8px;">+${ext.price} ден</span></div><button onclick="deleteExtra('${ext.id}')" style="padding:5px 10px;border-radius:7px;background:rgba(220,38,38,0.15);color:#FCA5A5;border:1px solid rgba(220,38,38,0.3);font-size:11px;cursor:pointer;">🗑️</button></div>`).join('')}</div></div>`
}

async function addExtra() {
  const name = document.getElementById('extName').value.trim()
  const price = parseFloat(document.getElementById('extPrice').value)
  if (!name || !price) { showMsg('❌ Пополни ги сите полиња!'); return }
  const { error } = await supabase.from('extras').insert({ name, price, restaurant_id: currentRestaurant.id })
  if (error) { showMsg('❌ ' + error.message); return }
  showMsg('✅ Додатокот е додаден!', 'success'); loadExtrasAdmin()
}

async function deleteExtra(id) { await supabase.from('extras').delete().eq('id', id); showMsg('✅ Избришано!', 'success'); loadExtrasAdmin() }

async function loadPrometAdmin() {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = '<p style="color:#90E0EF;padding:20px;">Се вчитува...</p>'
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  window._prometSelectedDate = window._prometSelectedDate || today
  const selDate = window._prometSelectedDate
  const { data: orders } = await supabase.from('orders')
    .select('total_amount, payment_type, payment_status')
    .eq('restaurant_id', currentRestaurant.id)
    .eq('payment_status', 'ПЛАТЕНО')
    .gte('created_at', selDate + 'T00:00:00')
    .lte('created_at', selDate + 'T23:59:59')
  const gotovina = (orders || []).filter(o => o.payment_type === 'ГОТОВИНА').reduce((s, o) => s + o.total_amount, 0)
  const karticka = (orders || []).filter(o => o.payment_type === 'КАРТИЧКА').reduce((s, o) => s + o.total_amount, 0)
  const vkupen = gotovina + karticka
  ac.innerHTML = `
    <div style="max-width:800px;">
      <h3 style="font-size:18px;font-weight:700;margin-bottom:20px;">💰 Промет</h3>
      <div style="display:flex;gap:10px;margin-bottom:20px;">
        <button onclick="switchPrometDate('${today}')" style="padding:8px 16px;border-radius:10px;background:${selDate === today ? 'linear-gradient(135deg,#ff5500,#ff9000)' : 'rgba(255,255,255,0.08)'};color:white;border:none;cursor:pointer;font-weight:600;font-size:13px;font-family:'Segoe UI',sans-serif;">📅 Денес</button>
        <button onclick="switchPrometDate('${yesterday}')" style="padding:8px 16px;border-radius:10px;background:${selDate === yesterday ? 'linear-gradient(135deg,#ff5500,#ff9000)' : 'rgba(255,255,255,0.08)'};color:white;border:none;cursor:pointer;font-weight:600;font-size:13px;font-family:'Segoe UI',sans-serif;">📅 Вчера</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
  <div style="padding:24px;border-radius:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);">
    <p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">💵 Готовина</p>
    <p style="font-size:32px;font-weight:900;color:#4ade80;">${gotovina} ден</p>
  </div>
  <div style="padding:24px;border-radius:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);">
    <p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">💳 Картичка</p>
    <p style="font-size:32px;font-weight:900;color:#00B4D8;">${karticka} ден</p>
  </div>
</div>
      <div style="padding:24px;border-radius:16px;background:rgba(255,100,0,0.08);border:1px solid rgba(255,100,0,0.3);margin-top:16px;">
        <p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">💰 Вкупен промет</p>
        <p style="font-size:36px;font-weight:900;color:#ff8030;">${vkupen} ден</p>
      </div>
    </div>`
}

function switchPrometDate(date) {
  window._prometSelectedDate = date
  loadPrometAdmin()
}
window.switchPrometDate = switchPrometDate

async function loadOrdersAdmin() {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = '<p style="color:#90E0EF;padding:20px;">Се вчитува...</p>'
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  window._ordersSelectedDate = window._ordersSelectedDate || today
  const selDate = window._ordersSelectedDate
  const { data: orders } = await supabase.from('orders').select('*, order_items(*, menu_items(name))').eq('restaurant_id', currentRestaurant.id).gte('created_at', selDate + 'T00:00:00').lte('created_at', selDate + 'T23:59:59').order('created_at', { ascending: false })

  ac.innerHTML = `<div style="max-width:800px;"><h3 style="font-size:18px;font-weight:700;margin-bottom:20px;">📊 Нарачки</h3>
<div style="display:flex;gap:10px;margin-bottom:20px;">
  <button onclick="switchOrdersDate('${today}')" style="padding:8px 16px;border-radius:10px;background:${selDate === today ? 'linear-gradient(135deg,#ff5500,#ff9000)' : 'rgba(255,255,255,0.08)'};color:white;border:none;cursor:pointer;font-weight:600;font-size:13px;font-family:'Segoe UI',sans-serif;">📅 Денес</button>
  <button onclick="switchOrdersDate('${yesterday}')" style="padding:8px 16px;border-radius:10px;background:${selDate === yesterday ? 'linear-gradient(135deg,#ff5500,#ff9000)' : 'rgba(255,255,255,0.08)'};color:white;border:none;cursor:pointer;font-weight:600;font-size:13px;font-family:'Segoe UI',sans-serif;">📅 Вчера</button>
</div>${!orders || orders.length === 0 ? `<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);"><p style="font-size:32px;">📊</p><p>Нема нарачки</p></div>` : orders.map((order, idx) => `<div data-interno="${order.payment_type === 'ИНТЕРНО' ? 'true' : 'false'}" style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);margin-bottom:10px;display:${order.payment_type === 'ИНТЕРНО' && !window._internoVisible ? 'none' : ''};"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-weight:700;">Нарачка #${orders.length - idx}</span><div style="display:flex;gap:8px;align-items:center;"><span style="font-size:11px;padding:3px 10px;border-radius:10px;background:rgba(0,180,216,0.15);color:#00B4D8;">${order.status}</span>${order.payment_type === 'ИНТЕРНО' ? `<span style="font-size:11px;padding:3px 10px;border-radius:10px;background:rgba(168,85,247,0.15);color:#D8B4FE;">🏠 ИНТЕРНО</span>` : ''}<span style="font-size:12px;color:rgba(255,255,255,0.4);">${new Date(order.created_at).toLocaleString('mk-MK')}</span></div></div>${order.order_items?.map(item => `<p style="font-size:13px;color:rgba(255,255,255,0.6);">${item.quantity}x ${item.menu_items?.name} — ${item.unit_price * item.quantity} ден</p>`).join('')}<p style="color:#ff8030;font-weight:700;margin-top:8px;">${order.total_amount} ден</p></div>`).join('')}</div>`
}

async function loadRestaurantAdmin() {
  const ac = document.getElementById('adminContent')
  ac.innerHTML = `<div style="max-width:500px;"><h3 style="font-size:18px;font-weight:700;margin-bottom:20px;">🏪 Информации за ресторанот</h3><div style="display:flex;flex-direction:column;gap:14px;">${adminInput('Ime на ресторан', 'rName', 'text', '', currentRestaurant.name || '')}${adminInput('Адреса', 'rAddress', 'text', '', currentRestaurant.address || '')}${adminInput('Телефон', 'rPhone', 'text', '', currentRestaurant.phone || '')}${adminInput('Опис', 'rDesc', 'text', '', currentRestaurant.description || '')}<button onclick="saveRestaurantInfo()" style="padding:14px;border-radius:12px;background:linear-gradient(135deg,#ff5500,#ff9000);color:white;border:none;font-weight:700;font-size:14px;cursor:pointer;font-family:'Segoe UI',sans-serif;">💾 Зачувај</button><div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;"><p style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:12px;">🔐 Промени Admin PIN:</p>${adminInput('Нов PIN (4 цифри)', 'newAdminPin', 'password', '••••')}<button onclick="changePin()" style="width:100%;padding:12px;border-radius:12px;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.2);font-weight:600;font-size:13px;cursor:pointer;margin-top:10px;font-family:'Segoe UI',sans-serif;">🔐 Промени PIN</button></div></div></div>`
}

async function saveRestaurantInfo() {
  const name = document.getElementById('rName').value.trim()
  const address = document.getElementById('rAddress').value.trim()
  const phone = document.getElementById('rPhone').value.trim()
  const description = document.getElementById('rDesc').value.trim()
  const { error } = await supabase.from('restaurants').update({ name, address, phone, description }).eq('id', currentRestaurant.id)
  if (error) { showMsg('❌ ' + error.message); return }
  currentRestaurant = { ...currentRestaurant, name, address, phone, description }
  document.getElementById('restaurantName').textContent = '🏪 ' + name
  showMsg('✅ Зачувано!', 'success')
}

async function changePin() {
  const newPin = document.getElementById('newAdminPin').value
  if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { showMsg('❌ PIN мора да биде точно 4 цифри!'); return }
  await supabase.from('profiles').update({ admin_pin: newPin }).eq('id', currentUser.id)
  showMsg('✅ PIN е сменет!', 'success')
}

function adminInput(label, id, type, placeholder, value = '') {
  return `<div><label style="display:block;font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:6px;letter-spacing:1px;text-transform:uppercase;">${label}</label><input type="${type}" id="${id}" placeholder="${placeholder}" value="${value}" style="width:100%;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:white;font-size:14px;outline:none;font-family:'Segoe UI',sans-serif;" /></div>`
}

window.showMsg = showMsg; window.login = login; window.logout = logout; window.showRegister = showRegister; window.showLogin = showLogin; window.registerRestaurant = registerRestaurant; window.switchTab = switchTab; window.showAdminPin = showAdminPin; window.createPin = createPin; window.verifyPin = verifyPin; window.renderAdmin = renderAdmin; window.loadAdminTab = loadAdminTab; window.loadMenuAdmin = loadMenuAdmin; window.showAddCategory = showAddCategory; window.saveNewCategory = saveNewCategory; window.deleteCategory = deleteCategory; window.showAddItem = showAddItem; window.saveNewItem = saveNewItem; window.toggleItem = toggleItem; window.deleteItem = deleteItem; window.loadTablesAdmin = loadTablesAdmin; window.addTable = addTable; window.saveNewTable = saveNewTable; window.deleteTable = deleteTable; window.loadIngredientsAdmin = loadIngredientsAdmin; window.addIngredient = addIngredient; window.deleteIngredient = deleteIngredient; window.loadExtrasAdmin = loadExtrasAdmin; window.addExtra = addExtra; window.deleteExtra = deleteExtra; window.loadOrdersAdmin = loadOrdersAdmin; window.loadRestaurantAdmin = loadRestaurantAdmin; window.saveRestaurantInfo = saveRestaurantInfo; window.changePin = changePin; window.selectTable = selectTable; window.addToCart = addToCart; window.removeFromCart = removeFromCart; window.changeQty = changeQty; window.clearCart = clearCart; window.sendToKitchen = sendToKitchen; window.payOrder = payOrder; window.selectCategory = selectCategory; window.filterMenu = filterMenu; window.updateOrderStatus = updateOrderStatus; window.renderPOS = renderPOS; window.openItemModal = openItemModal; window.closeItemModal = closeItemModal; window.toggleIngredient = toggleIngredient; window.toggleExtra = toggleExtra; window.saveItemFromModal = saveItemFromModal; window.addSameAsExisting = addSameAsExisting; window.handleCartClick = handleCartClick; window.editCartItem = editCartItem; window.saveEditedCartItem = saveEditedCartItem; window.applyEditAll = applyEditAll; window.selectAllIngs = selectAllIngs; window.openItemPrilozi = openItemPrilozi; window.togglePriloziIng = togglePriloziIng; window.togglePriloziExt = togglePriloziExt; window.closePriloziModal = closePriloziModal; window.toggleRemember = toggleRemember; window.goToNaplata = goToNaplata; window.closeNaplataModal = closeNaplataModal; window.renderNaplataModal = renderNaplataModal; window.startPodelba = startPodelba; window.togglePodelbaItem = togglePodelbaItem; window.selectPayType = selectPayType; window.presmetajResto = presmetajResto; window.naplatiPodelba = naplatiPodelba; window.finishNaplata = finishNaplata; window.openTimerModal = openTimerModal; window.acceptWithTimer = acceptWithTimer;
window.savePrilozi = savePrilozi; window.showSetPin2 = showSetPin2; window.savePin2 = savePin2;