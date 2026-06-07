(function () {
  const SUPABASE_URL = 'Supabase URL di sini';
  const SUPABASE_ANON_KEY = 'Supabase Publish Key di sini';
  const STORAGE_KEY = 'teja_orders_cache';
  const CHANNEL_NAME = 'teja-orders';

  const isConfigured =
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('Supabase URL di sini') &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes('Supabase Publish Key di sini');

  const client = isConfigured && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  function readCache() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function writeCache(orders) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent('teja-orders-updated', { detail: orders }));
  }

  function normalizeOrder(row) {
    if (!row) return null;
    return {
      id: row.id,
      meja: row.table_no || row.meja || '',
      customer: row.customer_name || row.customer || 'Pelanggan',
      payment: row.payment_method || row.payment || 'cash',
      payStatus: row.payment_status || row.payStatus || 'pending',
      orderStatus: row.order_status || row.orderStatus || 'baru',
      items: Array.isArray(row.items) ? row.items : [],
      note: row.note || '',
      total: Number(row.total_amount ?? row.total ?? 0),
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString()
    };
  }

  function toRow(order) {
    return {
      id: order.id,
      table_no: String(order.meja || order.table_no || ''),
      customer_name: order.customer || order.customer_name || 'Pelanggan',
      payment_method: order.payment || order.payment_method || 'cash',
      payment_status: order.payStatus || order.payment_status || 'pending',
      order_status: order.orderStatus || order.order_status || 'baru',
      items: order.items || [],
      note: order.note || '',
      total_amount: Number(order.total || order.total_amount || 0),
      updated_at: new Date().toISOString()
    };
  }

  async function listOrders() {
    if (!client) return readCache();

    const { data, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase listOrders failed, using cache:', error.message);
      return readCache();
    }

    const orders = (data || []).map(normalizeOrder).filter(Boolean);
    writeCache(orders);
    return orders;
  }

  async function getOrder(id) {
    if (!id) return null;
    if (!client) return readCache().find(order => order.id === id) || null;

    const { data, error } = await client
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.warn('Supabase getOrder failed, using cache:', error.message);
      return readCache().find(order => order.id === id) || null;
    }

    return normalizeOrder(data);
  }

  async function createOrder(order) {
    const normalized = normalizeOrder(order);
    if (!normalized) throw new Error('Order tidak valid.');

    const cached = readCache().filter(item => item.id !== normalized.id);
    writeCache([normalized, ...cached]);

    if (!client) return normalized;

    const { data, error } = await client
      .from('orders')
      .insert(toRow(normalized))
      .select()
      .single();

    if (error) throw error;
    const saved = normalizeOrder(data);
    const nextCache = readCache().map(item => item.id === saved.id ? saved : item);
    writeCache(nextCache);
    return saved;
  }

  async function updateOrder(id, changes) {
    const cached = readCache();
    const current = cached.find(order => order.id === id);
    const merged = normalizeOrder({ ...(current || { id }), ...changes, updatedAt: new Date().toISOString() });
    writeCache(cached.map(order => order.id === id ? merged : order));

    if (!client) return merged;

    const { data, error } = await client
      .from('orders')
      .update(toRow(merged))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    const saved = normalizeOrder(data);
    writeCache(readCache().map(order => order.id === id ? saved : order));
    return saved;
  }

  function subscribe(callback) {
    window.addEventListener('teja-orders-updated', event => callback(event.detail || readCache()));
    window.addEventListener('storage', event => {
      if (event.key === STORAGE_KEY) callback(readCache());
    });

    if (!client) return null;

    return client
      .channel(CHANNEL_NAME)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        callback(await listOrders());
      })
      .subscribe();
  }

  window.TejaSupabase = {
    isConfigured,
    listOrders,
    getOrder,
    createOrder,
    updateOrder,
    subscribe,
    normalizeOrder,
    paymentToCode(label) {
      const text = String(label || '').toLowerCase();
      if (text.includes('tunai') || text.includes('cash')) return 'cash';
      return 'qris';
    },
    formatTime(value) {
      const date = value ? new Date(value) : new Date();
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
  };
})();
