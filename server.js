
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

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    console.log("authHeader:", authHeader); // لاگ هدر Authorization

    if (!authHeader) {
        console.log("No authorization header found");
        return res.status(401).json({ error: "no_authorization_header" });
    }

    const parts = authHeader.split(" ");
    console.log("Authorization parts:", parts);

    if (parts.length !== 2 || parts[0] !== "Bearer") {
        console.log("Invalid authorization format");
        return res.status(400).json({ error: "invalid_authorization_format" });
    }

    const token = parts[1];
    if (!token) {
        console.log("Token is empty");
        return res.status(401).json({ error: "empty_token" });
    }

    const db = readData();
    console.log("Users in DB:", db.user);

    const user = (db.user || []).find(u => u.access_token === token);
    console.log("Matched user:", user);

    if (!user) {
        console.log("Invalid or expired token");
        return res.status(401).json({ error: "invalid_or_expired_token" });
    }

    req.user = user; // کاربر معتبر پیدا شد
    console.log("User authenticated:", user.email);
    next();
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

// مسیر oauth/token
app.post('/api/v1/oauth/token', upload.none(), (req, res) => {
  const db = readData();
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

    
    const new_access_token = Buffer.from(`access:${Date.now()}`).toString('base64');
    const new_refresh_token = Buffer.from(`refresh:${Date.now()}`).toString('base64');
    return res.json({
      access_token: new_access_token,
      token_type: 'bearer',
      refresh_token: new_refresh_token,
      expires_in: 3600
    });
  }

  res.status(400).json({ error: 'unsupported_grant_type' });
});



app.post('/api/v1/auth/token', (req, res) => {
  const { grant_type, username, password, client_id } = req.body || {};
  const db = readData();

  if (grant_type === 'password') {
    const user = (db.user || []).find(u => u.email === username && u.password === password);
    if (!user) return res.status(400).json({ error: 'invalid_credentials' });

    // ======= اینجا توکن بساز و ذخیره کن =======
    const token = Buffer.from(`${user.email}:${Date.now()}`).toString('base64');
    const refresh_token = Buffer.from(`refresh:${user.email}:${Date.now()}`).toString('base64');

    user.access_token = token;
    user.refresh_token = refresh_token;
    writeData(db);
    // =========================================

    return res.json({
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token
    });

  } else if (grant_type === 'refresh_token') {
    const refresh_token = req.body.refresh_token;
    if (!refresh_token) return res.status(400).json({ error: 'no_refresh_token' });

    const user = (db.user || []).find(u => u.refresh_token === refresh_token);
    if (!user) return res.status(401).json({ error: 'invalid_refresh_token' });

    // ======= توکن جدید بساز و ذخیره کن =======
    const token = Buffer.from(`${user.email}:${Date.now()}`).toString('base64');
    const new_refresh_token = Buffer.from(`refresh:${user.email}:${Date.now()}`).toString('base64');

    user.access_token = token;
    user.refresh_token = new_refresh_token;
    writeData(db);
    // ========================================

    return res.json({
      access_token: token,
      token_type: 'bearer',
      refresh_token: new_refresh_token,
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
  if (exists) return res.status(422).json({ error: 'user_exists' });
  const id = (db.user && db.user.length ? (Math.max(...db.user.map(u => parseInt(u.id))) + 1) : 1).toString();
  const newUser = { id: id.toString(), email, password, name: name || '' };
  db.user = db.user || [];
  db.user.push(newUser);
  writeData(db);
  res.json({ success: true, user: newUser });
});

// CART: add, list, remove, changeCount, count
app.post('/api/v1/cart/add', authMiddleware, (req, res) => {
  const { product_id } = req.body || {};

  if (!product_id) {
    return res.status(400).json({ error: "product_id required" });
  }

  const db = readData();
  db.cart = db.cart || [];

  const newId = db.cart.length
    ? Math.max(...db.cart.map(c => parseInt(c.id))) + 1
    : 1;

  const item = {
    id: newId,
    product_id: parseInt(product_id),
    count: 1,
    user_id: req.user.id
  };

  db.cart.push(item);
  writeData(db);

  res.json(item);
});

app.get('/api/v1/cart/list', authMiddleware, (req, res) => {
  const db = readData();

  db.cart = db.cart || [];
  db.product = db.product || [];
  console.log("db.product", db.product);
  // لیست آیتم‌های کاربر فعلی
  const userCart = db.cart.filter(c => c.user_id === req.user.id);

  // تبدیل به خروجی موردنظر
  const cart_items = userCart.map(item => {
    const product = db.product.find(p => p.id.toString() === item.product_id.toString());
    return {
      cart_item_id: parseInt(item.id),
      product: product || null,
      count: item.count
    };
  });

  // محاسبه قیمت‌ها
  let total_price = 0;
  let payable_price = 0;

  cart_items.forEach(ci => {
    if (ci.product) {
      const price = ci.product.price;
      const discount = ci.product.discount;

      total_price += price * ci.count;
      payable_price += (price - discount) * ci.count;
    }
  });

  res.json({
    cart_items,
    payable_price,
    total_price,
    shipping_cost: 0
  });
});



app.post('/api/v1/cart/remove', authMiddleware, (req, res) => {
  const { cart_item_id } = req.body || {};

  // 1. چک کردن اینکه cart_item_id ارسال شده یا نه
  if (!cart_item_id) {
    return res.status(400).json({
      error: "Failed",
      message: "شناسه در سبد خرید معتبر نیست"
    });
  }

  const db = readData();
  db.cart = db.cart || [];

  // 2. پیدا کردن آیتم
  const itemIndex = db.cart.findIndex(
    item => item.id.toString() === cart_item_id.toString()
  );

  if (itemIndex === -1) {
    // 3. اگر پیدا نشد
    return res.status(404).json({
      error: "Failed",
      message: "شناسه در سبد خرید  معتبر نیست"
    });
  }

  // 4. حذف آیتم
  db.cart.splice(itemIndex, 1);

  // 5. ذخیره دیتابیس
  writeData(db);

  // 6. پاسخ موفقیت بدون message
  return res.json({});
});


app.post('/api/v1/cart/changeCount', authMiddleware, (req, res) => {
  const { cart_item_id, count } = req.body || {};

  // 1. بررسی اینکه cart_item_id و count ارسال شده‌اند
  if (!cart_item_id || count === undefined) {
    return res.status(400).json({
      error: "Failed",
      message: "پارامترها معتبر نیستند"
    });
  }

  const db = readData();
  db.cart = db.cart || [];

  // 2. پیدا کردن آیتم در سبد خرید
  const itemIndex = db.cart.findIndex(
    item => item.id.toString() === cart_item_id.toString()
  );

  if (itemIndex === -1) {
    // 3. اگر آیتم پیدا نشد
    return res.status(404).json({
      error: "Failed",
      message: "شناسه در سبد خرید معتبر نیست"
    });
  }

  // 4. تغییر تعداد آیتم
  db.cart[itemIndex].count = count;

  // 5. ذخیره تغییرات
  writeData(db);

  // 6. پاسخ موفقیت آمیز با اطلاعات آیتم
  return res.json({
    id: db.cart[itemIndex].id,
    product_id: db.cart[itemIndex].product_id,
    count: db.cart[itemIndex].count
  });
});


app.get('/api/v1/cart/count', authMiddleware, (req, res) => {
  const db = readData();
  db.cart = db.cart || [];

  // تعداد آیتم‌ها
  const totalCount = db.cart.length;

  // پاسخ
  return res.json({
    count: totalCount
  });
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
