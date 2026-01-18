import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type StoreOrderRow = {
  order_ref: string;
  total_amount: number | null;
  status: string | null;
  created_at: string;
  buyer_email: string | null;
  currency: string | null;
  has_physical: boolean | null;
};

type StoreItemRow = {
  order_ref: string;
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  total_price: number;
};

type ProductRow = {
  product_id: string;
  name: string | null;
  is_physical: boolean | null;
  stock: number | null;
  low_stock_threshold: number | null;
};

export type StoreReportData = {
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  totalRevenue: number;
  averageTicket: number;
  paidOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  digitalRevenue: number;
  physicalRevenue: number;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  stockCritical: Array<{ name: string; stock: number; threshold: number }>;
  orders: StoreOrderRow[];
  items: StoreItemRow[];
};

const normalizeStatus = (value?: string | null) => (value || '').toLowerCase();

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT');

export const buildStoreReportData = async (
  supabaseServer: any,
  start: Date,
  end: Date,
): Promise<StoreReportData> => {
  const { data: orders, error: ordersError } = await supabaseServer
    .from('store_orders')
    .select('order_ref, total_amount, status, created_at, buyer_email, currency, has_physical')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: true });

  if (ordersError) throw ordersError;

  const orderRows = (orders || []) as StoreOrderRow[];
  const orderRefs = orderRows.map((order) => order.order_ref);
  const paidRefs = orderRows.filter((order) => normalizeStatus(order.status) === 'paid').map((o) => o.order_ref);

  const { data: items, error: itemsError } = orderRefs.length
    ? await supabaseServer
        .from('store_order_items')
        .select('order_ref, product_id, name, qty, unit_price, total_price')
        .in('order_ref', orderRefs)
    : { data: [], error: null };

  if (itemsError) throw itemsError;

  const itemRows = (items || []) as StoreItemRow[];
  const paidItems = itemRows.filter((item) => paidRefs.includes(item.order_ref));
  const productIds = paidItems.map((item) => item.product_id);

  const { data: products } = productIds.length
    ? await supabaseServer
        .from('store_products')
        .select('product_id, name, is_physical, stock, low_stock_threshold')
        .in('product_id', productIds)
    : { data: [] };

  const productMap = new Map<string, ProductRow>(
    ((products || []) as ProductRow[]).map((row) => [row.product_id, row]),
  );

  const paidOrders = orderRows.filter((order) => normalizeStatus(order.status) === 'paid');
  const pendingOrders = orderRows.filter((order) => normalizeStatus(order.status) === 'pending');
  const canceledOrders = orderRows.filter((order) =>
    ['canceled', 'cancelado', 'failed'].includes(normalizeStatus(order.status)),
  );

  const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const totalOrders = paidOrders.length;
  const averageTicket = totalOrders ? totalRevenue / totalOrders : 0;

  const productAgg = new Map<string, { name: string; qty: number; revenue: number }>();
  let digitalRevenue = 0;
  let physicalRevenue = 0;

  for (const item of paidItems) {
    const product = productMap.get(item.product_id);
    const isPhysical = product?.is_physical ?? true;
    const revenue = Number(item.total_price || item.unit_price * item.qty || 0);

    const entry = productAgg.get(item.product_id) || {
      name: product?.name || item.name || item.product_id,
      qty: 0,
      revenue: 0,
    };
    entry.qty += item.qty;
    entry.revenue += revenue;
    productAgg.set(item.product_id, entry);

    if (isPhysical) {
      physicalRevenue += revenue;
    } else {
      digitalRevenue += revenue;
    }
  }

  const topProducts = Array.from(productAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const { data: critical } = await supabaseServer
    .from('store_products')
    .select('product_id, name, stock, low_stock_threshold, is_physical')
    .eq('is_physical', true);

  const stockCritical = (critical || [])
    .filter((row: any) => typeof row.stock === 'number' && row.stock <= (row.low_stock_threshold ?? 0))
    .map((row: any) => ({
      name: row.name || row.product_id,
      stock: row.stock ?? 0,
      threshold: row.low_stock_threshold ?? 0,
    }))
    .slice(0, 6);

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    totalOrders,
    totalRevenue,
    averageTicket,
    paidOrders: paidOrders.length,
    pendingOrders: pendingOrders.length,
    canceledOrders: canceledOrders.length,
    digitalRevenue,
    physicalRevenue,
    topProducts,
    stockCritical,
    orders: orderRows,
    items: itemRows,
  };
};

export const renderStoreReportPdf = async (data: StoreReportData) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let cursorY = height - margin;

  const title = 'Relatorio mensal - Loja';
  page.drawText(title, {
    x: margin,
    y: cursorY,
    size: 18,
    font: fontBold,
    color: rgb(0.12, 0.18, 0.3),
  });
  cursorY -= 20;

  page.drawText(
    `Periodo: ${formatDate(data.periodStart)} a ${formatDate(data.periodEnd)}`,
    { x: margin, y: cursorY, size: 11, font: fontRegular, color: rgb(0.4, 0.46, 0.55) },
  );
  cursorY -= 22;

  const metrics = [
    ['Receita total', formatCurrency(data.totalRevenue)],
    ['Encomendas pagas', String(data.paidOrders)],
    ['Ticket medio', formatCurrency(data.averageTicket)],
    ['Pendentes', String(data.pendingOrders)],
    ['Canceladas', String(data.canceledOrders)],
    ['Digital', formatCurrency(data.digitalRevenue)],
    ['Fisico', formatCurrency(data.physicalRevenue)],
  ];

  metrics.forEach(([label, value]) => {
    page.drawText(`${label}:`, { x: margin, y: cursorY, size: 11, font: fontBold, color: rgb(0.2, 0.26, 0.36) });
    page.drawText(value, { x: margin + 160, y: cursorY, size: 11, font: fontRegular, color: rgb(0.2, 0.26, 0.36) });
    cursorY -= 14;
  });

  cursorY -= 12;
  page.drawText('Top produtos (receita)', { x: margin, y: cursorY, size: 12, font: fontBold, color: rgb(0.12, 0.18, 0.3) });
  cursorY -= 16;

  if (data.topProducts.length === 0) {
    page.drawText('Sem vendas no periodo.', { x: margin, y: cursorY, size: 11, font: fontRegular, color: rgb(0.4, 0.46, 0.55) });
    cursorY -= 14;
  } else {
    data.topProducts.forEach((item) => {
      page.drawText(`• ${item.name}`, { x: margin, y: cursorY, size: 11, font: fontRegular, color: rgb(0.2, 0.26, 0.36) });
      page.drawText(formatCurrency(item.revenue), { x: width - margin - 100, y: cursorY, size: 11, font: fontBold, color: rgb(0.12, 0.18, 0.3) });
      cursorY -= 14;
    });
  }

  cursorY -= 12;
  page.drawText('Stock critico', { x: margin, y: cursorY, size: 12, font: fontBold, color: rgb(0.12, 0.18, 0.3) });
  cursorY -= 16;

  if (data.stockCritical.length === 0) {
    page.drawText('Sem alertas de stock.', { x: margin, y: cursorY, size: 11, font: fontRegular, color: rgb(0.4, 0.46, 0.55) });
  } else {
    data.stockCritical.forEach((item) => {
      page.drawText(`• ${item.name}`, { x: margin, y: cursorY, size: 11, font: fontRegular, color: rgb(0.2, 0.26, 0.36) });
      page.drawText(`Stock: ${item.stock}`, { x: width - margin - 100, y: cursorY, size: 11, font: fontBold, color: rgb(0.65, 0.3, 0.2) });
      cursorY -= 14;
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};

export const renderStoreReportCsv = (data: StoreReportData) => {
  const rows = [
    ['order_ref', 'created_at', 'status', 'total_amount', 'currency', 'buyer_email', 'items'],
  ];

  const itemsByOrder = data.items.reduce<Record<string, string[]>>((acc, item) => {
    const line = `${item.name} x${item.qty}`;
    acc[item.order_ref] = acc[item.order_ref] || [];
    acc[item.order_ref].push(line);
    return acc;
  }, {});

  data.orders.forEach((order) => {
    rows.push([
      order.order_ref,
      order.created_at,
      order.status || '',
      String(order.total_amount ?? 0),
      order.currency || 'EUR',
      order.buyer_email || '',
      (itemsByOrder[order.order_ref] || []).join(' | '),
    ]);
  });

  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
};
