
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, 'db.json');

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read db.json', e);
    return {};
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Helper for pagination
function paginate(items, page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page || 1));
  const l = Math.max(1, parseInt(limit || 20));
  const start = (p - 1) * l;
  return items.slice(start, start + l);
}

// PRODUCT LIST with sort handling (sort same as tutorial)
// sort: 0 = latest (by id desc), 1 = popular (no metric, return as-is), 2 = price high->low, 3 = price low->high
app.get('/api/v1/product/list', (req, res) => {
  const db = readData();
  let products = db.product || [];
  const sort = req.query.sort ? parseInt(req.query.sort) : 0;
  switch (sort) {
    case 0: // latest: id desc (ids are strings sometimes)
      products = products.sort((a, b) => parseInt(b.id) - parseInt(a.id));
      break;
    case 1: // popular (no metric) -> keep order or random example
      // leave as-is
      break;
    case 2: // price high to low
      products = products.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 3: // price low to high
      products = products.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
  }
  // support page & limit
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const result = paginate(products, page, limit);
  res.json(result);
});

// PRODUCT SEARCH: q in title (case-insensitive)
app.get('/api/v1/product/search', (req, res) => {
  const q = (req.query.q || '').toString().trim().toLowerCase();
  const db = readData();
  const products = db.product || [];
  if (!q) return res.json([]);
  const filtered = products.filter(p => (p.title || '').toString().toLowerCase().includes(q));
  res.json(filtered);
});

// BANNER slider
app.get('/api/v1/banner/slider', (req, res) => {
  const db = readData();
  res.json(db.banner || []);
});

const multer = require('multer');
const upload = multer(); 

// Middleware برای JSON و URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// دیتابیس نمونه
const db = {
  user: [
    { email: 'test@example.com', password: '123456' }
  ]
};

// مسیر oauth/token
app.post('/api/v1/oauth/token', upload.none(), (req, res) => {
  console.log('req.body:', req.body); // نمایش داده‌ها برای debug
  const { grant_type, username, password, refresh_token } = req.body;
  console.log("Incoming body:", req.body);
  if (grant_type === 'password') {
    const user = (db.user || []).find(u => u.email === username && u.password === password);
    if (!user) return res.status(400).json({ error: 'invalid_credentials' });

    const token = Buffer.from(`${user.email}:${Date.now()}`).toString('base64');
    const new_refresh_token = Buffer.from(`refresh:${user.email}:${Date.now()}`).toString('base64');

    return res.json({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: new_refresh_token
    });
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) return res.status(400).json({ error: 'no_refresh_token' });

    const token = Buffer.from(`refreshed:${Date.now()}`).toString('base64');
    return res.json({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600
    });
  }

  res.status(400).json({ error: 'unsupported_grant_type' });
});







// USER register (add minimal user)
app.post('/api/v1/user/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
  const db = readData();
  const exists = (db.user || []).find(u => u.email === email);
  if (exists) return res.status(400).json({ error: 'user_exists' });
  const id = (db.user && db.user.length ? (Math.max(...db.user.map(u => parseInt(u.id))) + 1) : 1).toString();
  const newUser = { id: id.toString(), email, password, name: name || '' };
  db.user = db.user || [];
  db.user.push(newUser);
  writeData(db);
  res.json({ success: true, user: newUser });
});

// CART: add, list, remove, changeCount, count
app.post('/api/v1/cart/add', (req, res) => {
  const { product_id, count, user_id } = req.body || {};
  if (!product_id) return res.status(400).json({ error: 'product_id required' });
  const db = readData();
  db.cart = db.cart || [];
  const id = (db.cart.length ? (Math.max(...db.cart.map(c => parseInt(c.id))) + 1) : 1).toString();
  const item = { id: id.toString(), product_id: product_id.toString(), count: count ? parseInt(count) : 1, user_id: user_id || null };
  db.cart.push(item);
  writeData(db);
  res.json({ success: true, cart_item: item });
});

app.get('/api/v1/cart/list', (req, res) => {
  const db = readData();
  res.json(db.cart || []);
});

app.post('/api/v1/cart/remove', (req, res) => {
  const { cart_item_id } = req.body || {};
  if (!cart_item_id) return res.status(400).json({ error: 'cart_item_id required' });
  const db = readData();
  db.cart = (db.cart || []).filter(c => c.id !== cart_item_id.toString());
  writeData(db);
  res.json({ success: true });
});

app.post('/api/v1/cart/changeCount', (req, res) => {
  const { cart_item_id, count } = req.body || {};
  if (!cart_item_id) return res.status(400).json({ error: 'cart_item_id required' });
  const db = readData();
  db.cart = db.cart || [];
  const item = db.cart.find(c => c.id === cart_item_id.toString());
  if (!item) return res.status(404).json({ error: 'not_found' });
  item.count = parseInt(count);
  writeData(db);
  res.json({ success: true, item });
});

app.get('/api/v1/cart/count', (req, res) => {
  const db = readData();
  const count = (db.cart || []).length;
  res.json({ count });
});

// ORDER: list, submit, checkout, update/status
app.get('/api/v1/order/list', (req, res) => {
  const db = readData();
  res.json(db.order || []);
});

app.post('/api/v1/order/submit', (req, res) => {
  const order = req.body || {};
  const db = readData();
  db.order = db.order || [];
  const id = (db.order.length ? (Math.max(...db.order.map(o => parseInt(o.id))) + 1) : 1).toString();
  const newOrder = Object.assign({ id: id.toString(), status: 'pending', created_at: new Date().toISOString() }, order);
  db.order.push(newOrder);
  writeData(db);
  res.json({ success: true, order: newOrder });
});

app.get('/api/v1/order/checkout', (req, res) => {
  const order_id = req.query.order_id;
  const db = readData();
  const order = (db.order || []).find(o => o.id === (order_id || '').toString());
  if (!order) return res.status(404).json({ error: 'order_not_found' });
  // simulate checkout success
  order.status = 'payed';
  writeData(db);
  res.json({ success: true, order });
});

app.get('/api/v1/order/update/status', (req, res) => {
  const order_id = req.query.order_id || req.query.id;
  const status = req.query.status;
  if (!order_id || !status) return res.status(400).json({ error: 'order_id_and_status_required' });
  const db = readData();
  const order = (db.order || []).find(o => o.id === order_id.toString());
  if (!order) return res.status(404).json({ error: 'order_not_found' });
  order.status = status;
  writeData(db);
  res.json({ success: true, order });
});

// COMMENT: list and add
app.get('/api/v1/comment/list', (req, res) => {
  const product_id = req.query.product_id;
  const db = readData();
  const comments = db.comment || [];
  if (product_id) {
    return res.json(comments.filter(c => c.id.toString() === product_id.toString()));
  }
  res.json(comments);
});

app.post('/api/v1/comment/add', (req, res) => {
  const { title, content, product_id, user } = req.body || {};
  if (!product_id) return res.status(400).json({ error: 'product_id required' });
  const db = readData();
  db.comment = db.comment || [];
  const id = (db.comment.length ? (Math.max(...db.comment.map(c => parseInt(c.id))) + 1) : 1).toString();
  const newComment = { id: id.toString(), product_id: product_id.toString(), title: title || '', content: content || '', user: user || 'anonymous' };
  db.comment.push(newComment);
  writeData(db);
  res.json({ success: true, comment: newComment });
});

// fallback message
app.get('/', (req, res) => {
  res.send('Nike-mock API is running. See /api/v1/product/list');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server listening on port', PORT);
});
