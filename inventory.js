const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmWPQ-MjzuKXTY0opDH9tzQzDe2Y_-uqquSBYDcGJeEqtHQbnQr7sTW4FBv_g2_NUhtGcjpanv6Jnh/pub?gid=0&single=true&output=csv";

let allCards = [];

const cardGrid = document.getElementById('cardGrid');
const statusMessage = document.getElementById('statusMessage');
const searchInput = document.getElementById('searchInput');
const setFilter = document.getElementById('setFilter');
const conditionFilter = document.getElementById('conditionFilter');

function loadInventory() {
  Papa.parse(SHEET_CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      allCards = results.data.filter(row => {
        const qty = parseInt(row['Quantity'], 10);
        return row['Name'] && qty > 0;
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
  const sets = [...new Set(allCards.map(c => c['Set Name']).filter(Boolean))].sort();
  const conditions = [...new Set(allCards.map(c => c['Condition']).filter(Boolean))].sort();

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

    const foil = (card['Foil'] || '').toLowerCase() === 'foil' ? ' · Foil' : '';
    const price = card['Purchase price'] ? `$${parseFloat(card['Purchase price']).toFixed(2)}` : '—';

    const imageUrl = card['Image URL'] && card['Image URL'].startsWith('http') ? card['Image URL'] : null;
const imageHtml = imageUrl
  ? `<img class="card-image" src="${imageUrl}" alt="${card['Name']}" loading="lazy">`
  : `<div class="card-image card-image-placeholder">No image</div>`;

tile.innerHTML = `
  ${imageHtml}
  <div class="card-info">
    <div class="card-name">${card['Name']}</div>
    <div class="card-set">${card['Set Name'] || card['Set Code'] || ''}${foil}</div>
    <div class="card-meta">
      <span>${card['Condition'] || 'Unknown'} · Qty ${card['Quantity']}</span>
      <span class="card-price">${price}</span>
    </div>
  </div>
`;
    cardGrid.appendChild(tile);
  });
}

function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase();
  const selectedSet = setFilter.value;
  const selectedCondition = conditionFilter.value;

  const filtered = allCards.filter(card => {
    const matchesSearch = card['Name'].toLowerCase().includes(searchTerm);
    const matchesSet = !selectedSet || card['Set Name'] === selectedSet;
    const matchesCondition = !selectedCondition || card['Condition'] === selectedCondition;
    return matchesSearch && matchesSet && matchesCondition;
  });

  renderCards(filtered);
}

searchInput.addEventListener('input', applyFilters);
setFilter.addEventListener('change', applyFilters);
conditionFilter.addEventListener('change', applyFilters);

loadInventory();