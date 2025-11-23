const express = require("express");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// مسیر فایل دیتابیس
const dbPath = path.join(__dirname, "db.json");

function readData() {
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

/* ------------------------------------------------------
   BANNER APIs
-------------------------------------------------------*/
app.get("/api/v1/banner/slider", (req, res) => {
  const db = readData();
  res.json(db.slider || []);
});

/* ------------------------------------------------------
   PRODUCT APIs
-------------------------------------------------------*/

// لیست محصولات
app.get("/api/v1/product/list", (req, res) => {
  const db = readData();
  res.json(db.product || []);
});

// دیتیل محصول
app.get("/api/v1/product/detail", (req, res) => {
  const { id } = req.query;
  const db = readData();
  const item = (db.product || []).find((p) => p.id == id);

  if (!item) return res.status(404).json({ error: "Product not found" });

  res.json(item);
});

/* ------------------------------------------------------
   COMMENT APIs (کاملاً بازنویسی و اصلاح شده)
-------------------------------------------------------*/

// دریافت لیست کامنت‌ها
app.get("/api/v1/comment/list", (req, res) => {
  const product_id = req.query.product_id;
  const db = readData();
  const comments = db.comment || [];

  // اگر هیچ product_id در query نبود → همه را بده
  if (!product_id) {
    return res.json(comments);
  }

  // آیا در دیتابیس اصلاً کامنتی وجود دارد که product_id داشته باشد؟
  const hasProductId = comments.some((c) => c.product_id !== undefined);

  // اگر کامنت‌ها product_id ندارند → همه را برگردان
  if (!hasProductId) {
    return res.json(comments);
  }

  // حالت عادی: فیلتر بر اساس product_id
  const filtered = comments.filter(
    (c) => c.product_id && c.product_id.toString() === product_id.toString()
  );

  res.json(filtered);
});

// افزودن کامنت جدید
app.post("/api/v1/comment/add", (req, res) => {
  const { title, content, product_id, user } = req.body || {};

  if (!title || !content) {
    return res.status(400).json({ error: "title and content are required" });
  }

  const db = readData();
  db.comment = db.comment || [];

  const id =
    db.comment.length > 0
      ? Math.max(...db.comment.map((c) => parseInt(c.id))) + 1
      : 1;

  const newComment = {
    id: id.toString(),
    title,
    content,
    // اگر product_id فرستاده شده باشد → اضافه کن
    product_id: product_id ? product_id.toString() : undefined,
    date: new Date().toISOString(),
    author: user || { email: "anonymous@example.com" },
  };

  db.comment.push(newComment);
  writeData(db);

  res.json({ success: true, comment: newComment });
});

/* ------------------------------------------------------
   SERVER START
-------------------------------------------------------*/

app.listen(9000, () => {
  console.log("Mock API running on http://localhost:9000");
});
