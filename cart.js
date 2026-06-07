/**
 * UrbanDine — Shared Cart Manager
 */

const Cart = (() => {
  const KEY = 'urbandine_cart';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function add(nama, harga, img = '') {
    const data = load();
    if (data[nama]) {
      data[nama].qty += 1;
      if (!data[nama].img && img) data[nama].img = img;
    } else {
      data[nama] = { harga: parseInt(harga), qty: 1, img: img };
    }
    save(data);
    _notifyUpdate();
  }

  function remove(nama) {
    const data = load();
    if (!data[nama]) return;
    data[nama].qty -= 1;
    if (data[nama].qty <= 0) delete data[nama];
    save(data);
    _notifyUpdate();
  }

  function deleteItem(nama) {
    const data = load();
    delete data[nama];
    save(data);
    _notifyUpdate();
  }

  function clear() {
    save({});
    _notifyUpdate();
  }

  function totalQty() {
    return Object.values(load()).reduce((s, i) => s + i.qty, 0);
  }

  function totalPrice() {
    return Object.values(load()).reduce((s, i) => s + i.harga * i.qty, 0);
  }

  function getAll() { return load(); }

  function formatRupiah(n) {
    return 'Rp ' + parseInt(n).toLocaleString('id-ID');
  }

  function _notifyUpdate() { updateFAB(); }

  function updateFAB() {
    const qty      = totalQty();
    const fab      = document.getElementById('fab-cart');
    const badge    = document.getElementById('fab-badge');
    const fabTotal = document.getElementById('fab-total');
    if (!fab) return;

    if (badge)    { badge.textContent = qty; badge.setAttribute('aria-label', qty + ' item'); }
    if (fabTotal) { fabTotal.textContent = formatRupiah(totalPrice()); }

    if (qty === 0) {
      fab.classList.add('fab--hidden');
    } else {
      fab.classList.remove('fab--hidden');
      fab.classList.remove('fab--bump');
      void fab.offsetWidth;
      fab.classList.add('fab--bump');
      setTimeout(() => fab.classList.remove('fab--bump'), 350);
    }

    if (badge) {
      badge.classList.remove('badge--pop');
      void badge.offsetWidth;
      badge.classList.add('badge--pop');
      setTimeout(() => badge.classList.remove('badge--pop'), 350);
    }
  }

  function init() {
    const qty      = totalQty();
    const fab      = document.getElementById('fab-cart');
    const badge    = document.getElementById('fab-badge');
    const fabTotal = document.getElementById('fab-total');
    if (!fab) return;

    if (badge)    { badge.textContent = qty; badge.setAttribute('aria-label', qty + ' item'); }
    if (fabTotal) { fabTotal.textContent = formatRupiah(totalPrice()); }
    if (qty > 0)  { fab.classList.remove('fab--hidden'); }
    else          { fab.classList.add('fab--hidden'); }
  }

  return { add, remove, deleteItem, clear, totalQty, totalPrice, getAll, formatRupiah, updateFAB, init };
})();

document.addEventListener('DOMContentLoaded', () => {
  Cart.init();
  bindAllAddButtons();
});

function bindAllAddButtons() {
  document.querySelectorAll('.btn-add').forEach(bindAddButton);
}

/**
 * Cari gambar secara otomatis dari card terdekat jika data-img tidak ada.
 * Urutan prioritas pencarian img:
 *   1. data-img di tombol itu sendiri
 *   2. img di dalam card parent (.drink-card, .food-card, .hero-slide, .sg-card, .dg-card, .fl-card, .bento-item)
 *   3. img src dari hero-slide data-img attribute (untuk hero)
 */
function resolveImg(btn) {
  // 1. Tombol punya data-img sendiri
  if (btn.dataset.img) return btn.dataset.img;

  // 2. Cari card parent terdekat lalu ambil img pertama di dalamnya
  const cardSelectors = [
    '.drink-card', '.food-card', '.hero-slide', '.hero-card',
    '.sg-card', '.dg-card', '.fl-card', '.bento-item', '.food-card'
  ];
  for (const sel of cardSelectors) {
    const card = btn.closest(sel);
    if (card) {
      // Kalau card hero, cek data-img di card itu
      if (card.dataset.img) return card.dataset.img;
      // Cari tag img di dalam card
      const imgEl = card.querySelector('img');
      if (imgEl && imgEl.src) return imgEl.src;
    }
  }

  return '';
}

function bindAddButton(btn) {
  if (btn.dataset.cartBound) return;
  btn.dataset.cartBound = '1';

  btn.addEventListener('click', function (e) {
    e.stopPropagation();

    const nama  = this.dataset.nama  || '';
    const harga = parseInt(this.dataset.harga) || 0;
    if (!nama || !harga) return;

    // Cari gambar otomatis
    const img = resolveImg(this);

    const originalHTML  = this.innerHTML;
    const originalClass = this.className;
    this.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size:18px">progress_activity</span>';
    this.disabled  = true;

    setTimeout(() => {
      this.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">check_circle</span>';
      this.classList.add('btn-success');
      Cart.add(nama, harga, img);

      setTimeout(() => {
        this.innerHTML = originalHTML;
        this.className = originalClass;
        this.disabled  = false;
      }, 1500);
    }, 600);
  });
}