const express = require('express');
const cors = require('cors');
const db = require('./db'); // ✅ correct import
const port = 3000;
const app = express();

app.use(cors());
app.use(express.json());

// ✅ Use db.query, NOT pool.query
app.get('/api/menu-items', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, item_name, rate FROM menu_items');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching menu items');
  }
});

app.get('/api/order-history', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT customer_name, customer_phone, item_name, total_quantity,order_type, total_spent_on_item
      FROM public.customer_order_items
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching order history');
  }
});

app.post('/api/orders', async (req, res) => {
  const {
    customer_name,
    table_number,
    order_type,
    payment_status,
    items,
  } = req.body;

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 🔢 Calculate values
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = parseFloat((subtotal * 0.10).toFixed(2)); // 10%
    const gst = parseFloat(((subtotal - discount) * 0.18).toFixed(2)); // 18%
    const total_amount = parseFloat((subtotal - discount + gst).toFixed(2));

    // 🔢 Generate bill number
    const { rows: billRows } = await db.query(`SELECT nextval('bill_number_seq') AS bill_no`);
    const bill_number = `BILL-${String(billRows[0].bill_no).padStart(6, '0')}`;

    // ✅ Insert into orders table
    const orderResult = await db.query(
      `INSERT INTO orders 
        (customer_name, table_number, subtotal, discount, gst, total_amount, order_type, payment_status, bill_number, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id`,
      [
        customer_name,
        table_number,
        subtotal,
        discount,
        gst,
        total_amount,
        order_type,
        payment_status,
        bill_number,
      ]
    );

    const orderId = orderResult.rows[0].id;

    // ✅ Insert each item into order_items table
    for (const item of items) {
      await db.query(
        `INSERT INTO order_items 
          (order_id, item_name, price, quantity, total, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          orderId,
          item.item_name,
          item.price,
          item.quantity,
          item.price * item.quantity,
        ]
      );
    }

    await client.query('COMMIT');

    // ✅ Send bill number and total in response
    res.status(200).json({
      success: true,
      orderId,
      billNumber: bill_number,
      subtotal,
      discount,
      gst,
      totalAmount: total_amount,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving order:', err);
    res.status(500).json({ success: false, message: 'Error saving order' });
  } finally {
    client.release();
  }
});
const parseParam = (param) => (param === undefined ? null : param)

app.get('/api/dashboard/sales-by-item', async (req, res) => {
  const { startDate, endDate } = req.query

  try {
    const query = `
      SELECT oi.item_name,
             SUM(oi.total) AS total_sales
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE ($1::date IS NULL OR o.created_at >= $1)
        AND ($2::date IS NULL OR o.created_at <= $2)
      GROUP BY oi.item_name
      ORDER BY total_sales DESC
    `
    const { rows } = await db.query(query, [parseParam(startDate), parseParam(endDate)])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/dashboard/daily-sales', async (req, res) => {
  const { startDate, endDate } = req.query

  try {
    const query = `
      SELECT DATE(o.created_at) AS date,
             SUM(o.total_amount) AS total_sales
      FROM orders o
      WHERE ($1::date IS NULL OR o.created_at >= $1)
        AND ($2::date IS NULL OR o.created_at <= $2)
      GROUP BY date
      ORDER BY date
    `
    const { rows } = await db.query(query, [parseParam(startDate), parseParam(endDate)])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/dashboard/payment-status-distribution', async (req, res) => {
  const { startDate, endDate } = req.query

  try {
    const query = `
      SELECT o.payment_status,
             COUNT(*) AS count_orders,
             SUM(o.total_amount) AS total_amount
      FROM orders o
      WHERE ($1::date IS NULL OR o.created_at >= $1)
        AND ($2::date IS NULL OR o.created_at <= $2)
      GROUP BY o.payment_status
    `
    const { rows } = await db.query(query, [parseParam(startDate), parseParam(endDate)])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/dashboard/top-pending-customers', async (req, res) => {
  try {
    const query = `
      SELECT customer_name,
             customer_phone,
             COUNT(*) AS pending_bills_count,
             SUM(total_amount) AS total_pending_amount
      FROM orders
      WHERE payment_status = 'Pending'
      GROUP BY customer_name, customer_phone
      ORDER BY total_pending_amount DESC
      LIMIT 5
    `
    const { rows } = await db.query(query)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
