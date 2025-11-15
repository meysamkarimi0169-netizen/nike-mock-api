
Nike Mock API - Ready to deploy
==============================

Files in this package:
- server.js        : Express server implementing endpoints like the tutorial
- db.json          : data store (products, banner, users, comments, cart, order)
- package.json     : dependencies and start script
- README.md        : this file

How to deploy on Glitch (one-click):
1. Create a new project on Glitch (Sign in required).
2. Use "Import from GitHub" OR upload these files into a new project.
   - If uploading, put package.json, server.js, db.json at project root.
3. Glitch will run `npm install` then `npm start`. The app listens on process.env.PORT.
4. Your base URL will be like https://your-project.glitch.me
   The API root will be: https://your-project.glitch.me/api/v1/

Available endpoints (examples):
- GET  /api/v1/product/list?sort=0&page=1&limit=20
- GET  /api/v1/product/search?q=sam
- GET  /api/v1/banner/slider
- POST /api/v1/oauth/token   (grant_type=password OR refresh_token)
- POST /api/v1/user/register
- POST /api/v1/cart/add
- GET  /api/v1/cart/list
- POST /api/v1/cart/remove
- POST /api/v1/cart/changeCount
- GET  /api/v1/cart/count
- GET  /api/v1/order/list
- POST /api/v1/order/submit
- GET  /api/v1/order/checkout?order_id=1
- GET  /api/v1/order/update/status?order_id=1&status=payed
- GET  /api/v1/comment/list?product_id=1
- POST /api/v1/comment/add

Notes:
- This mock server stores data in db.json. On Glitch, disk is writable but may not be permanent long-term.
- For production-like persistence, consider deploying to Render/Railway with a database.
