/* ==========================================================================
   1. Configuration
   ========================================================================== */
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmWPQ-MjzuKXTY0opDH9tzQzDe2Y_-uqquSBYDcGJeEqtHQbnQr7sTW4FBv_g2_NUhtGcjpanv6Jnh/pub?gid=0&single=true&output=csv";
const SEALED_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmWPQ-MjzuKXTY0opDH9tzQzDe2Y_-uqquSBYDcGJeEqtHQbnQr7sTW4FBv_g2_NUhtGcjpanv6Jnh/pub?gid=1158130730&single=true&output=csv";


/* ==========================================================================
   2. State
   ========================================================================== */
let allCards = [];
let allSealed = [];


/* ==========================================================================
   3. DOM references
   ========================================================================== */

/* MTG Singles view */
const cardGrid = document.getElementById('cardGrid');
const statusMessage = document.getElementById('statusMessage');
const searchInput = document.getElementById('searchInput');
const setFilter = document.getElementById('setFilter');
const conditionFilter = document.getElementById('conditionFilter');

/* Sealed product view */
const sealedGrid = document.getElementById('sealedGrid');
const sealedStatusMessage = document.getElementById('sealedStatusMessage');
const sealedSearchInput = document.getElementById('sealedSearchInput');

/* View toggle */
const singlesToggle = document.getElementById('singlesToggle');
const sealedToggle = document.getElementById('sealedToggle');
const singlesView = document.getElementById('singlesView');
const sealedView = document.getElementById('sealedView');

/* Lightbox */
const lightbox = document.getElementById('imageLightbox');
const lightboxImage = document.getElementById('lightboxImage');


/* ==========================================================================
   4. Helpers
   ========================================================================== */

/* Formats ManaBox condition values ("near_mint") into display text ("Near Mint") */
function formatCondition(raw) {
  if (!raw) return 'Unknown';
  return raw
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}


/* ==========================================================================
   5. Tile cart control
   Reads/writes the shared cart (from script.js) and renders the
   Add to Cart / stepper UI on a single tile.
   ========================================================================== */
function renderTileCartControl(tileEl, cardId, cardName, price) {
  const container = tileEl.querySelector('.cart-control');
  if (!container) return;

  /* Don't rebuild out from under someone mid-keystroke */
  const active = document.activeElement;
  if (active && active.classList.contains('qty-input') && container.contains(active)) return;

  const qty = getCartQuantity(cardId);
  const stock = parseInt(tileEl.dataset.stock, 10) || 0;

  if (qty === 0) {
    container.innerHTML = `<button class="add-to-cart-btn">Add to Cart</button>`;
    container.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      queueQuantityChange(cardId, cardName, price, 1, tileEl, false);
    });
    return;
  }

  container.innerHTML = `
    <div class="qty-stepper">
      <button class="qty-btn" data-step="down">−</button>
      <input class="qty-input" type="number" min="0" max="${stock}" value="${qty}">
      <button class="qty-btn" data-step="up" ${qty >= stock ? 'disabled' : ''}>+</button>
    </div>
  `;

  container.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = btn.dataset.step === 'up' ? qty + 1 : qty - 1;
      queueQuantityChange(cardId, cardName, price, next, tileEl, false);
    });
  });

  const input = container.querySelector('.qty-input');
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('input', () => {
    if (input.value === '') return;
    queueQuantityChange(cardId, cardName, price, parseInt(input.value, 10) || 0, tileEl, true);
  });
  input.addEventListener('blur', () => {
    if (input.value === '') {
      queueQuantityChange(cardId, cardName, price, 0, tileEl, false);
    } else {
      renderTileCartControl(tileEl, cardId, cardName, price);
    }
  });
}

/* Re-syncs every visible tile with the cart. Called by script.js after a
   bulk change (expiry sweep, full cart release). */
function refreshAllTileControls() {
  document.querySelectorAll('.card-tile[data-card-id]').forEach(tile => {
    renderTileCartControl(tile, tile.dataset.cardId, tile.dataset.cardName, parseFloat(tile.dataset.price) || 0);
  });
}


/* ==========================================================================
   6. Lightbox
   ========================================================================== */
function openLightbox(src) {
  lightboxImage.src = src;
  lightbox.classList.add('active');
}

function closeLightbox() {
  lightbox.classList.remove('active');
  lightboxImage.src = '';
}


/* ==========================================================================
   7. MTG Singles — load, render, filter
   ========================================================================== */
function loadInventory() {
  Papa.parse(SHEET_CSV_URL + "&t=" + new Date().getTime(), {
    download: true,
    header: true,
    skipEmptyLines: true,
    /* ManaBox exports use inconsistent casing, so normalize every header */
    transformHeader: (h) => h.trim().toLowerCase(),
    complete: (results) => {
      allCards = results.data.filter(row => {
        const qty = parseInt(row['quantity'], 10);
        return row['name'] && qty > 0;
      });
      populateFilters();
      renderCards(allCards);
      statusMessage.textContent = `${allCards.length} cards in stock`;
    },
    error: () => {
      statusMessage.textContent = "Couldn't load inventory right now. Please check back soon.";
    }
  });
}

function populateFilters() {
  const sets = [...new Set(allCards.map(c => c['set name']).filter(Boolean))].sort();
  const conditions = [...new Set(allCards.map(c => formatCondition(c['condition'])).filter(Boolean))].sort();

  sets.forEach(set => {
    const opt = document.createElement('option');
    opt.value = set;
    opt.textContent = set;
    setFilter.appendChild(opt);
  });

  conditions.forEach(cond => {
    const opt = document.createElement('option');
    opt.value = cond;
    opt.textContent = cond;
    conditionFilter.appendChild(opt);
  });
}

function renderCards(cards) {
  cardGrid.innerHTML = '';

  if (cards.length === 0) {
    cardGrid.innerHTML = '<p class="inventory-status">No cards match your search.</p>';
    return;
  }

  cards.forEach(card => {
    const tile = document.createElement('div');
    tile.className = 'card-tile';

    const foil = (card['foil'] || '').toLowerCase() === 'foil' ? ' · Foil' : '';
    const priceValue = parseFloat(card['purchase price']) || 0;
    const price = card['purchase price'] ? `$${priceValue.toFixed(2)}` : '—';
    const condition = formatCondition(card['condition']);

    /* Skip anything that isn't a real URL — the Image URL column can hold
       error text like "NOT FOUND" when a Scryfall lookup fails */
    const imageUrl = card['image url'] && card['image url'].startsWith('http') ? card['image url'] : null;
    const imageHtml = imageUrl
      ? `<img class="card-image" src="${imageUrl}" alt="${card['name']}" loading="lazy">`
      : `<div class="card-image card-image-placeholder">No image</div>`;

    const cardId = card['manabox id'] || card['scryfall id'];
    tile.dataset.cardId = cardId;
    tile.dataset.cardName = card['name'];
    tile.dataset.stock = card['quantity'];
    tile.dataset.price = priceValue;

    tile.innerHTML = `
      ${imageHtml}
      <div class="card-info">
        <div class="card-name">${card['name']}</div>
        <div class="card-set">${card['set name'] || card['set code'] || ''}${foil}</div>
        <div class="card-meta">
          <span>${condition} · Qty ${card['quantity']}</span>
          <span class="card-price">${price}</span>
        </div>
        <div class="cart-control"></div>
      </div>
    `;
    cardGrid.appendChild(tile);

    const img = tile.querySelector('.card-image');
    if (img && imageUrl) {
      img.addEventListener('click', () => openLightbox(imageUrl));
    }

    renderTileCartControl(tile, cardId, card['name'], priceValue);
  });
}

function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase();
  const selectedSet = setFilter.value;
  const selectedCondition = conditionFilter.value;

  const filtered = allCards.filter(card => {
    const matchesSearch = card['name'].toLowerCase().includes(searchTerm);
    const matchesSet = !selectedSet || card['set name'] === selectedSet;
    const matchesCondition = !selectedCondition || formatCondition(card['condition']) === selectedCondition;
    return matchesSearch && matchesSet && matchesCondition;
  });

  renderCards(filtered);
}


/* ==========================================================================
   8. Sealed product — load, render, filter
   Headers here are hand-typed rather than imported, so they keep their
   original capitalization. No cart controls yet, that's a separate piece.
   ========================================================================== */
function loadSealed() {
  Papa.parse(SEALED_CSV_URL + "&t=" + new Date().getTime(), {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      allSealed = results.data.filter(row => {
        const qty = parseInt(row['Quantity'], 10);
        return row['Item Name'] && qty > 0;
      });
      renderSealed(allSealed);
      sealedStatusMessage.textContent = `${allSealed.length} items in stock`;
    },
    error: () => {
      sealedStatusMessage.textContent = "Couldn't load sealed product right now. Please check back soon.";
    }
  });
}

function renderSealed(items) {
  sealedGrid.innerHTML = '';

  if (items.length === 0) {
    sealedGrid.innerHTML = '<p class="inventory-status">No items match your search.</p>';
    return;
  }

  items.forEach(item => {
    const tile = document.createElement('div');
    tile.className = 'card-tile';

    const imageUrl = item['Image URL'] && item['Image URL'].startsWith('http') ? item['Image URL'] : null;
    const imageHtml = imageUrl
      ? `<img class="card-image" src="${imageUrl}" alt="${item['Item Name']}" loading="lazy">`
      : `<div class="card-image card-image-placeholder">See this product in store</div>`;
    const price = item['Price'] ? `$${parseFloat(item['Price']).toFixed(2)}` : '—';

    tile.innerHTML = `
      ${imageHtml}
      <div class="card-info">
        <div class="card-name">${item['Item Name']}</div>
        <div class="card-set">${item['Product Line'] || ''}</div>
        <div class="card-meta">
          <span>Qty ${item['Quantity']}</span>
          <span class="card-price">${price}</span>
        </div>
      </div>
    `;
    sealedGrid.appendChild(tile);

    const img = tile.querySelector('.card-image');
    if (img && imageUrl) {
      img.addEventListener('click', () => openLightbox(imageUrl));
    }
  });
}

function applySealedFilter() {
  const term = sealedSearchInput.value.toLowerCase();
  const filtered = allSealed.filter(item => item['Item Name'].toLowerCase().includes(term));
  renderSealed(filtered);
}


/* ==========================================================================
   9. Event listeners
   ========================================================================== */

/* Singles filters */
searchInput.addEventListener('input', applyFilters);
setFilter.addEventListener('change', applyFilters);
conditionFilter.addEventListener('change', applyFilters);

/* Sealed filter */
sealedSearchInput.addEventListener('input', applySealedFilter);

/* View toggle — sealed data only loads the first time it's opened */
singlesToggle.addEventListener('click', () => {
  singlesToggle.classList.add('active');
  sealedToggle.classList.remove('active');
  singlesView.style.display = 'block';
  sealedView.style.display = 'none';
});

sealedToggle.addEventListener('click', () => {
  sealedToggle.classList.add('active');
  singlesToggle.classList.remove('active');
  sealedView.style.display = 'block';
  singlesView.style.display = 'none';
  if (allSealed.length === 0) loadSealed();
});

/* Lightbox */
lightbox.addEventListener('click', closeLightbox);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});


/* ==========================================================================
   10. Init
   ========================================================================== */
loadInventory();