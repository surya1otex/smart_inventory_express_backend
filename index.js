/**
 * Main Application Entry Point
 * Smart Inventory Management System API
 */

// Load environment variables (config/.env must apply — see utils/env.js)
const { loadEnv } = require('./utils/env');
loadEnv();

// Import required modules
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Import custom modules
const { pool, testConnection } = require('./config/db');
const productRoutes = require('./routes/product.routes');
const supplierRoutes = require('./routes/supplier.routes');
const categoryRoutes = require('./routes/category.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const salesRoutes = require('./routes/sales.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const authRoutes = require('./routes/auth.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

// Initialize Express app
const app = express();
const httpServer = http.createServer(app);

// Socket.io configuration
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    methods: ['GET', 'POST'],
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected: ' + socket.id);

  socket.on('disconnect', () => {
    console.log('Socket disconnected: ' + socket.id);
  });
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Store database pool in app.locals for access in controllers
app.locals.db = pool;

// ============================================
// NEW MODULAR ROUTES
// ============================================
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);
// ============================================
// LEGACY ROUTES (existing endpoints)
// ============================================

// Legacy MySQL connection (for backward compatibility)
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_inventory',
});

db.connect((err) => {
  if (err) {
    console.error('Legacy DB connection error:', err.stack);
    return;
  }
  console.log('Legacy DB connected.');
});

// Fetch all items with categories
app.get('/api/allitems', (req, res) => {
  const query = 'SELECT * FROM products INNER JOIN categories on products.category_id = categories.category_id;';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching items:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json(results);
  });
});

// Fetch store by ID
app.get('/api/store/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM res_stores WHERE store_id = ?';

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching store:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }

    res.status(200).json(results[0]);
  });
});

// Add new store
app.post('/api/store/add', (req, res) => {
  const { firstCtrl, secondCtrl } = req.body;

  const sql = `INSERT INTO res_stores (store_name, contact, address) VALUES (?, ?, ?)`;
  db.query(sql, [firstCtrl, 50, secondCtrl], (err, result) => {
    if (err) {
      console.error('Error inserting Store:', err);
      res.status(500).json({ message: 'Error inserting Store', error: err });
    } else {
      res.status(200).json({ message: 'Store added successfully', productId: result.insertId });
    }
  });
});

// Add store items with file upload
app.post('/api/storeitems/items', upload.any(), async (req, res) => {
  try {
    const body = req.body;
    const files = req.files;

    const items = [];

    Object.keys(body).forEach(key => {
      if (key.startsWith('item_')) {
        const index = key.split('_')[1];
        const item = JSON.parse(body[key]);

        const file = files.find(f => f.fieldname === `photo_${index}`);
        item.photo = file ? file.filename : null;

        items.push(item);
      }
    });

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No valid items received' });
    }

    const sql = 'INSERT INTO res_items (store_id, item, price, instock, image) VALUES ?';
    const values = items.map(item => [
      item.store,
      item.productName,
      item.price,
      50,
      item.photo || ''
    ]);

    console.log('data insert to db are', values);

    db.query(sql, [values], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Insert failed' });
      }
      io.emit('newItem', { message: 'New order created!', order: 'test response' });
      res.json({ message: 'Items inserted with images', inserted: result.affectedRows });
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch store items by store ID
app.get('/api/storeitems/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM res_items WHERE store_id = ?';

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error fetching store items:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Store items not found' });
    }

    res.status(200).json(results);
  });
});

// Fetch products by category
app.get('/api/products/category/:category_id', (req, res) => {
  const { category_id } = req.params;
  const query = 'SELECT * FROM products WHERE category_id = ?';

  db.query(query, [category_id], (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.status(200).json(results);
  });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Test database connection and start server
testConnection().then(() => {
  httpServer.listen(PORT, HOST, () => {
    console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
    console.log(`📦 Product API: POST http://${HOST}:${PORT}/api/products`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
});
