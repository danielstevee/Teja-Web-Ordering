(function () {
  const SUPABASE_URL = 'Supabase URL Anda';
  const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
  const STORAGE_KEY = 'teja_orders_cache';
  const CHANNEL_NAME = 'teja-orders';
  const normalizedUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

  const isConfigured =
    normalizedUrl.startsWith('https://') &&
    !normalizedUrl.includes('YOUR_PROJECT_ID') &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY');

  const client = isConfigured && window.supabase
    ? window.supabase.createClient(normalizedUrl, SUPABASE_ANON_KEY)
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
    const legacyStatus = row.status || '';
    const orderStatus =
      row.order_status ||
      row.orderStatus ||
      (['diproses', 'siap', 'selesai', 'ditolak'].includes(legacyStatus) ? legacyStatus : 'baru');
    const payment = row.payment_method || row.payment || 'cash';
    const payStatus =
      row.payment_status ||
      row.payStatus ||
      (legacyStatus === 'paid' || payment !== 'cash' ? 'paid' : 'pending');

    return {
      id: row.order_id || row.id,
      meja: row.table_no || row.table_number || row.meja || '',
      customer: row.customer_name || row.customer || 'Pelanggan',
      payment,
      payStatus,
      orderStatus,
      items: Array.isArray(row.items) ? row.items : [],
      note: row.note || '',
      total: Number(row.total_amount ?? row.total ?? row.amount ?? 0),
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString()
    };
  }

  function toRow(order) {
    return {
      id: order.id,
      order_id: order.id,
      table_no: String(order.meja || order.table_no || ''),
      table_number: Number(order.meja || order.table_number || 0),
      customer_name: order.customer || order.customer_name || 'Pelanggan',
      payment_method: order.payment || order.payment_method || 'cash',
      payment_status: order.payStatus || order.payment_status || 'pending',
      order_status: order.orderStatus || order.order_status || 'baru',
      status: order.orderStatus || order.order_status || 'baru',
      items: order.items || [],
      note: order.note || '',
      total_amount: Number(order.total || order.total_amount || 0),
      total: Number(order.total || order.total_amount || 0),
      updated_at: new Date().toISOString()
    };
  }

  function toLegacyRow(order) {
    return {
      order_id: order.id,
      table_number: Number(order.meja || 0),
      total: Number(order.total || 0),
      payment_method: order.payment || 'cash',
      status: order.payStatus === 'paid' && order.orderStatus === 'baru'
        ? 'paid'
        : (order.orderStatus || 'baru')
    };
  }

  function isSchemaError(error) {
    return ['PGRST204', '42703'].includes(error?.code);
  }

  function toItemRows(order) {
    return (order.items || []).map((item, index) => {
      const qty = Number(item.qty || 0);
      const unitPrice = Number(item.price ?? item.harga ?? 0);
      return {
        order_id: order.id,
        item_name: item.name || item.nama || '',
        qty,
        unit_price: unitPrice,
        subtotal: qty * unitPrice,
        image_url: item.img || '',
        sort_order: index + 1
      };
    });
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

    let { data, error } = await client
      .from('orders')
      .select('*')
      .eq('order_id', id)
      .single();

    if (error && isSchemaError(error)) {
      const legacyResult = await client
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
      data = legacyResult.data;
      error = legacyResult.error;
    }

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

    let { data, error } = await client
      .from('orders')
      .insert(toRow(normalized))
      .select()
      .single();

    if (error) {
      const legacyResult = await client
        .from('orders')
        .insert(toLegacyRow(normalized))
        .select()
        .single();
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error) throw error;

    const itemRows = toItemRows(normalized);
    if (itemRows.length) {
      const { error: itemsError } = await client
        .from('order_items')
        .insert(itemRows);

      if (itemsError && !isSchemaError(itemsError)) throw itemsError;
      if (itemsError) {
        console.warn('Detail item belum tersimpan. Jalankan supabase-schema.sql untuk menambah kolom order_items:', itemsError.message);
      }
    }

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

    let { data, error } = await client
      .from('orders')
      .update(toRow(merged))
      .eq('order_id', id)
      .select()
      .single();

    if (error) {
      const legacyResult = await client
        .from('orders')
        .update(toLegacyRow(merged))
        .eq('order_id', id)
        .select()
        .single();
      data = legacyResult.data;
      error = legacyResult.error;
    }

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
