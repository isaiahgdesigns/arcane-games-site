/* ==========================================================================
   1. Configuration
   ========================================================================== */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby0HAm8HibjE4R-bHIfO4qnr94t_XfIW6uRSYZrkGW2S8aeK3sETE64Uw4mEQzRMdz0/exec";
const HOLD_MINUTES = 10;
const WARNING_SECONDS = 60;
const SYNC_DELAY_MS = 600;


/* ==========================================================================
   2. State
   ========================================================================== */
let warningDismissed = false;
const pendingSync = {};


/* ==========================================================================
   3. DOM references
   ========================================================================== */

/* Nav */
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

/* Tonight's event (homepage only) */
const tonightNameEl = document.getElementById('tonightName');
const tonightTimeEl = document.getElementById('tonightTime');
const tonightCopyEl = document.getElementById('tonightCopy');
const tonightLabelEl = document.getElementById('tonightLabel');

/* Cart */
const cartBanner = document.getElementById('cartBanner');
const cartBannerText = document.getElementById('cartBannerText');
const viewCartBtn = document.getElementById('viewCartBtn');
const cartPanel = document.getElementById('cartPanel');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartItemsEl = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const floatingCartBtn = document.getElementById('floatingCartBtn');
const floatingCartCount = document.getElementById('floatingCartCount');

/* Expiry warning */
const expiryModal = document.getElementById('expiryModal');
const expiryCountdown = document.getElementById('expiryCountdown');
const extendHoldBtn = document.getElementById('extendHoldBtn');
const dismissExpiryBtn = document.getElementById('dismissExpiryBtn');


/* ==========================================================================
   4. Nav toggle (mobile hamburger menu)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');
});

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}


/* ==========================================================================
   5. Tonight's event (homepage only)
   ========================================================================== */
const weeklySchedule = {
  1: { name: "Board Game Night", time: "5:00 PM · Free", copy: "Bring your favorite board game or borrow one of ours. All ages and experience levels welcome." },
  2: { name: "Nexus Night", time: "6:00 PM · $8 entry", copy: "Pull up a chair, bring a deck, and settle in. Nexus Night runs every week for Riftbound and Magic players looking for a real table and real competition." },
  4: { name: "Commander Night", time: "5:00 PM · Free", copy: "Grab your deck and call your crew. All planeswalkers and experience levels welcome to the table." },
  5: { name: "Pauper Night", time: "6:00 PM · Free", copy: "Budget-friendly Magic at its finest. Commons and uncommons only, skill still required." }
};

function loadTonightEvent() {
  if (!tonightNameEl) return;

  const today = new Date().getDay();
  const event = weeklySchedule[today];

  if (event) {
    tonightLabelEl.textContent = "Tonight";
    tonightNameEl.textContent = event.name;
    tonightTimeEl.textContent = event.time;
    tonightCopyEl.textContent = event.copy;
  } else {
    tonightLabelEl.textContent = "This Week";
    tonightNameEl.textContent = "Nothing scheduled tonight";
    tonightTimeEl.textContent = "";
    tonightCopyEl.textContent = "But there's always something on the calendar. Check out our full weekly lineup and upcoming special events.";
  }
}

loadTonightEvent();


/* ==========================================================================
   6. Session & cart storage
   Holds live on the server (Google Sheet). This is just the browser's local
   record of what this visitor is holding, so the UI can stay in sync.
   ========================================================================== */
function getSessionId() {
  let id = sessionStorage.getItem('arcaneSessionId');
  if (!id) {
    id = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem('arcaneSessionId', id);
  }
  return id;
}
const SESSION_ID = getSessionId();

function getCart() {
  const raw = sessionStorage.getItem('arcaneCart');
  return raw ? JSON.parse(raw) : [];
}

function saveCart(cart) {
  sessionStorage.setItem('arcaneCart', JSON.stringify(cart));
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
}

function getCartQuantity(cardId) {
  const item = getCart().find(i => i.cardId === cardId);
  return item ? item.quantity : 0;
}


/* ==========================================================================
   7. Backend calls (Apps Script Web App)
   ========================================================================== */
async function callBackend(action, payload = {}) {
  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ action, sessionId: SESSION_ID }, payload))
  });
  return response.json();
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}


/* ==========================================================================
   8. Cart quantity actions
   Used by both the panel here and by inventory.js's tile controls.
   ========================================================================== */

/* Called by every quantity control. Updates the browser's cart immediately
   so the UI feels instant, then tells the server once the person stops. */
function queueQuantityChange(cardId, cardName, price, newQty, tileEl, skipTileRender) {
  const stock = tileEl ? parseInt(tileEl.dataset.stock, 10) || 0 : Infinity;
  newQty = Math.max(0, Math.min(newQty, stock));

  applyCartQuantity(cardId, cardName, price, newQty, provisionalExpiry());
  updateCartUI();

  if (tileEl && !skipTileRender && typeof renderTileCartControl === 'function') {
    renderTileCartControl(tileEl, cardId, cardName, price);
  }
  if (cartPanel.style.display === 'block') renderCartPanel();

  clearTimeout(pendingSync[cardId]);
  pendingSync[cardId] = setTimeout(
    () => syncQuantity(cardId, cardName, price, tileEl),
    SYNC_DELAY_MS
  );
}

/* Optimistic expiry so the item isn't filtered out as expired before the
   server has had a chance to confirm the real one. */
function provisionalExpiry() {
  return new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();
}

/* Sends the settled quantity. If the server can't honour it, we fall back to
   whatever it says is actually available. */
async function syncQuantity(cardId, cardName, price, tileEl) {
  const desired = getCartQuantity(cardId);
  const result = await callBackend('setQuantity', { cardId, quantity: desired });

  if (result.success) {
    applyCartQuantity(cardId, cardName, price, result.quantity, result.expiresAt);
  } else {
    const fallback = typeof result.maxAvailable === 'number' ? Math.min(desired, result.maxAvailable) : 0;
    applyCartQuantity(cardId, cardName, price, fallback, result.expiresAt);
    alert(result.error || "That many aren't available right now.");
  }

  if (tileEl && typeof renderTileCartControl === 'function') {
    renderTileCartControl(tileEl, cardId, cardName, price);
  }
  if (cartPanel.style.display === 'block') renderCartPanel();
  updateCartUI();
}

/* Writes a quantity into the browser's cart copy. A server response also
   carries a fresh expiry, which applies to every item at once. */
function applyCartQuantity(cardId, cardName, price, quantity, expiresAt) {
  let cart = getCart().filter(item => item.cardId !== cardId);
  if (expiresAt) {
    cart = cart.map(item => Object.assign({}, item, { expiresAt }));
  }
  if (quantity > 0) {
    cart.push({ cardId, cardName, price: price || 0, quantity, expiresAt });
  }
  saveCart(cart);
}

async function releaseEntireCart() {
  const cart = getCart();
  await Promise.all(
    cart.map(item => callBackend('setQuantity', { cardId: item.cardId, quantity: 0 }))
  );
  saveCart([]);
  hideExpiryWarning();
  if (typeof refreshAllTileControls === 'function') refreshAllTileControls();
  updateCartUI();
}


/* ==========================================================================
   9. Checkout
   ========================================================================== */
async function startCheckout() {
  const cart = getCart();
  if (cart.length === 0) return;

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = 'Redirecting to checkout...';

  const result = await callBackend('createCheckoutSession', { cart });

  if (result.success && result.url) {
    window.location.href = result.url;
  } else {
    alert(result.error || "Couldn't start checkout. Please try again.");
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = 'Checkout';
  }
}


/* ==========================================================================
   10. Cart banner, expiry warning & panel
   ========================================================================== */

/* Runs once a second on every page. Drops expired items and keeps the
   banner, floating count, and panel (if open) in sync. */
function updateCartUI() {
  const cart = getCart();
  const now = new Date();

  const validCart = cart.filter(item => new Date(item.expiresAt) > now);
  if (validCart.length !== cart.length) {
    saveCart(validCart);
    if (typeof refreshAllTileControls === 'function') refreshAllTileControls();
  }

  const totalItems = validCart.reduce((sum, item) => sum + item.quantity, 0);

  document.body.classList.toggle('cart-banner-active', totalItems > 0);
  floatingCartCount.textContent = totalItems;

  if (totalItems === 0) {
    cartBanner.style.display = 'none';
    hideExpiryWarning();
    if (cartPanel.style.display === 'block') renderCartPanel();
    return;
  }

  cartBanner.style.display = 'block';
  cartBannerText.textContent =
    `${totalItems} card${totalItems > 1 ? 's' : ''} held for you while you browse. ` +
    `Anything not purchased is released back to the shop.`;

  if (cartPanel.style.display === 'block') renderCartPanel();

  const soonest = validCart.reduce((min, item) =>
    new Date(item.expiresAt) < new Date(min.expiresAt) ? item : min
  );
  const secondsLeft = Math.max(0, Math.floor((new Date(soonest.expiresAt) - now) / 1000));

  if (secondsLeft <= WARNING_SECONDS && !warningDismissed) {
    expiryModal.style.display = 'flex';
    expiryCountdown.textContent = formatCountdown(secondsLeft);
  } else if (secondsLeft > WARNING_SECONDS) {
    warningDismissed = false;
    expiryModal.style.display = 'none';
  }
}

function hideExpiryWarning() {
  expiryModal.style.display = 'none';
  warningDismissed = false;
}

async function extendHolds() {
  const result = await callBackend('extend');
  if (result.success) {
    const cart = getCart().map(item => Object.assign({}, item, { expiresAt: result.expiresAt }));
    saveCart(cart);
  }
  hideExpiryWarning();
  updateCartUI();
}

function openCartPanel() {
  renderCartPanel();
  cartPanel.style.display = 'block';
}

function closeCartPanel() {
  cartPanel.style.display = 'none';
}

/* Works on every page. On Inventory, clicking +/− or Remove finds the
   matching card tile if one exists on screen. On other pages there's no
   tile, and that's fine, the request still goes through normally. */
function renderCartPanel() {
  const active = document.activeElement;
  if (active && active.classList.contains('qty-input') && cartItemsEl.contains(active)) return;

  const now = new Date();
  const validCart = getCart().filter(item => new Date(item.expiresAt) > now);

  if (validCart.length === 0) {
    cartItemsEl.innerHTML = '<p class="inventory-status">Your cart is empty.</p>';
    cartTotalEl.textContent = '';
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Checkout';
    return;
  }

  cartItemsEl.innerHTML = validCart.map(item => {
    const subtotal = (item.price || 0) * item.quantity;
    return `
      <div class="cart-item" data-card-id="${item.cardId}">
        <div style="flex:1; min-width:0;">
          <div class="cart-item-name">${item.cardName}</div>
          <div class="cart-item-line">
            <div class="cart-item-qty">
              <button class="qty-btn" data-panel-step="down" data-card-id="${item.cardId}">−</button>
              <input class="qty-input" type="number" min="0" value="${item.quantity}" data-card-id="${item.cardId}">
              <button class="qty-btn" data-panel-step="up" data-card-id="${item.cardId}">+</button>
            </div>
            <span class="cart-item-subtotal">$${subtotal.toFixed(2)}</span>
          </div>
        </div>
        <button class="cart-item-remove" data-remove-id="${item.cardId}">Remove</button>
      </div>
    `;
  }).join('');

  const totalItems = validCart.reduce((sum, item) => sum + item.quantity, 0);
  cartTotalEl.innerHTML =
    `Total: <span>$${getCartTotal().toFixed(2)}</span>` +
    `<span class="cart-total-count">${totalItems} card${totalItems > 1 ? 's' : ''} held</span>`;

  checkoutBtn.disabled = false;
  checkoutBtn.textContent = 'Checkout';

  cartItemsEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cardId = btn.dataset.cardId;
      const item = getCart().find(i => i.cardId === cardId);
      if (!item) return;
      const next = btn.dataset.panelStep === 'up' ? item.quantity + 1 : item.quantity - 1;
      const tile = document.querySelector(`.card-tile[data-card-id="${cardId}"]`);
      queueQuantityChange(cardId, item.cardName, item.price, next, tile, false);
    });
  });

  cartItemsEl.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('input', () => {
      if (input.value === '') return;
      const cardId = input.dataset.cardId;
      const item = getCart().find(i => i.cardId === cardId);
      if (!item) return;
      const tile = document.querySelector(`.card-tile[data-card-id="${cardId}"]`);
      queueQuantityChange(cardId, item.cardName, item.price, parseInt(input.value, 10) || 0, tile, true);
    });
    input.addEventListener('blur', () => {
      if (input.value === '') renderCartPanel();
    });
  });

  cartItemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const cardId = btn.dataset.removeId;
      const item = getCart().find(i => i.cardId === cardId);
      if (!item) return;
      const tile = document.querySelector(`.card-tile[data-card-id="${cardId}"]`);
      queueQuantityChange(cardId, item.cardName, item.price, 0, tile, false);
    });
  });
}


/* ==========================================================================
   11. Event listeners
   ========================================================================== */
viewCartBtn.addEventListener('click', openCartPanel);
floatingCartBtn.addEventListener('click', openCartPanel);
closeCartBtn.addEventListener('click', closeCartPanel);
checkoutBtn.addEventListener('click', startCheckout);
extendHoldBtn.addEventListener('click', extendHolds);
dismissExpiryBtn.addEventListener('click', releaseEntireCart);

/* Release holds when the visitor leaves, so cards don't sit locked for the
   full 10 minutes. sendBeacon survives page unload; a normal fetch wouldn't.
   Not guaranteed on a crash, the server-side expiry is still the real backstop. */
window.addEventListener('pagehide', () => {
  const cart = getCart();
  if (cart.length === 0) return;
  cart.forEach(item => {
    navigator.sendBeacon(
      WEB_APP_URL,
      JSON.stringify({ action: 'setQuantity', cardId: item.cardId, quantity: 0, sessionId: SESSION_ID })
    );
  });
});


/* ==========================================================================
   12. Init
   ========================================================================== */
setInterval(updateCartUI, 1000);
updateCartUI();