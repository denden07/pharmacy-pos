import { dbPromise } from './index.js';

async function populateSampleData() {
  const db = await dbPromise;

  /* =========================
     Sample Medicines
  ========================== */
  const medicines = [
    { name: 'Biogesic 500mg', generic_name: 'Paracetamol', price1: 15, price2: 13 },
    { name: 'Alaxan 400mg', generic_name: 'Ibuprofen', price1: 20, price2: 18 },
    { name: 'Decolgen', generic_name: 'Phenylephrine + Chlorpheniramine', price1: 25, price2: 22 }
  ];

  for (let med of medicines) await db.add('medicines', med);

  /* =========================
     Inventory Batches
  ========================== */
  const inventoryBatches = [
    { medicine_id: 1, quantity: 100, expiry_date: '2026-12-31' },
    { medicine_id: 1, quantity: 50, expiry_date: null },
    { medicine_id: 2, quantity: 200, expiry_date: '2025-11-30' },
    { medicine_id: 3, quantity: 150, expiry_date: '2027-01-15' }
  ];

  for (let batch of inventoryBatches) await db.add('inventory_batches', batch);

  /* =========================
     Price History
  ========================== */
  const priceHistory = [
    { medicine_id: 1, old_price1: 14, old_price2: 12, new_price1: 15, new_price2: 13, changed_at: '2025-01-01' },
    { medicine_id: 2, old_price1: 19, old_price2: 17, new_price1: 20, new_price2: 18, changed_at: '2025-02-01' }
  ];

  for (let ph of priceHistory) await db.add('price_history', ph);

  /* =========================
     Customers
  ========================== */
  const customers = [
    { name: 'Juan Dela Cruz', id_number: '12345678', address: 'Manila', is_senior: false },
    { name: 'Maria Santos', id_number: '87654321', address: 'Quezon City', is_senior: true }
  ];

  for (let cust of customers) await db.add('customers', cust);

  /* =========================
     Sales (Headers)
  ========================== */
  const sales = [
    { customer_id: 1, date: '2026-01-01', total_amount: 45, manual_discount: 0, senior_discount: 0, final_total: 45 },
    { customer_id: 2, date: '2026-01-02', total_amount: 65, manual_discount: 5, senior_discount: 5, final_total: 55 }
  ];

  const saleIds = [];
  for (let sale of sales) saleIds.push(await db.add('sales', sale));

  /* =========================
     Sale Items (Per Medicine)
  ========================== */
  const salesItems = [
    { sales_id: saleIds[0], medicine_id: 1, quantity: 3, is_piece_or_box: 'piece', price_at_sale: 15, price_type: 'price1', batch_id: 1 },
    { sales_id: saleIds[0], medicine_id: 2, quantity: 1, is_piece_or_box: 'box', price_at_sale: 20, price_type: 'price1', batch_id: 3 },
    { sales_id: saleIds[1], medicine_id: 3, quantity: 2, is_piece_or_box: 'piece', price_at_sale: 22, price_type: 'price2', batch_id: 4 }
  ];

  for (let item of saleItems) await db.add('sales_items', item);

  /* =========================
     Points History
  ========================== */
  const pointsHistory = [
    { customer_id: 1, year: 2026, points_earned: 0, points_used: 0 },
    { customer_id: 2, year: 2026, points_earned: 1, points_used: 0 }
  ];

  for (let ph of pointsHistory) await db.add('points_history', ph);

  /* =========================
     Yearly Points
  ========================== */
  const yearlyPoints = [
    { customer_id: 1, year: 2026, points: 0 },
    { customer_id: 2, year: 2026, points: 1 }
  ];

  for (let yp of yearlyPoints) await db.add('yearly_points', yp);

  console.log('✅ All sample tables populated!');
}

// Run immediately
populateSampleData();
