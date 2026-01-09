const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');
const app = express();

// --- 1. CONFIGURATION ---
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true })); // Critical for Form Data
app.use(express.json()); // Critical for API/JSON data
app.use(session({ 
    secret: 'inventory_secret', 
    resave: false, 
    saveUninitialized: true 
}));

// --- 2. DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: 'localhost', 
    user: 'root', 
    password: '', 
    database: 'inventory_db'
});

db.connect((err) => {
    if (err) console.error("Database connection failed: " + err.stack);
    else console.log("Connected to MySQL Database.");
});

// --- 3. MIDDLEWARE (AUTH CHECK) ---
// Prevents unauthorized access to pages
const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/login');
};

// --- 4. AUTHENTICATION ROUTES ---
app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (results && results.length > 0) {
            req.session.user = results[0];
            res.redirect('/');
        } else {
            res.send('Invalid Credentials');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- 5. DASHBOARD ---
app.get('/', isAuthenticated, (req, res) => {
    const statsQuery = `
        SELECT 
            (SELECT COUNT(*) FROM products) AS total_products,
            (SELECT COUNT(*) FROM products WHERE stock_quantity < 10) AS low_stock,
            (SELECT COUNT(*) FROM users) AS total_users
    `;

    db.query(statsQuery, (err, statsResults) => {
        if (err) return res.send("Error loading stats.");
        db.query('SELECT * FROM products', (err, products) => {
            res.render('dashboard', { 
                user: req.session.user, 
                stats: statsResults[0], 
                products: products 
            });
        });
    });
});

// --- 6. PRODUCT & INVENTORY MANAGEMENT ---
app.get('/products', isAuthenticated, (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
        res.render('products', { user: req.session.user, products: results });
    });
});

app.post('/add-product', isAuthenticated, (req, res) => {
    const { product_name, barcode, category, price, stock_quantity } = req.body;
    const sql = "INSERT INTO products (product_name, barcode, category, price, stock_quantity) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [product_name, barcode, category, price, stock_quantity], (err) => {
        if (err) return res.send("Error: Check if barcode is unique.");
        res.redirect('/products');
    });
});

app.get('/inventory', isAuthenticated, (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
        res.render('inventory', { user: req.session.user, products: results });
    });
});

// --- 7. SUPPLIER MANAGEMENT ---
app.get('/suppliers', isAuthenticated, (req, res) => {
    db.query('SELECT * FROM suppliers', (err, results) => {
        if (err) return res.status(500).send("Database Error: 'suppliers' table missing.");
        res.render('suppliers', { user: req.session.user, suppliers: results });
    });
});

app.post('/add-supplier', isAuthenticated, (req, res) => {
    const { name, contact, address } = req.body;
    const sql = "INSERT INTO suppliers (name, contact, address) VALUES (?, ?, ?)";
    db.query(sql, [name, contact, address], (err) => {
        if (err) return res.status(500).send("Database Error: " + err.message);
        res.redirect('/suppliers');
    });
});

// --- 8. POS & BARCODE ---
app.get('/pos', isAuthenticated, (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
        res.render('pos', { user: req.session.user, products: results });
    });
});

app.get('/barcode', isAuthenticated, (req, res) => {
    res.render('barcode', { user: req.session.user });
});

app.get('/api/product/:barcode', (req, res) => {
    const barcode = req.params.barcode;
    db.query('SELECT * FROM products WHERE barcode = ?', [barcode], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false });
        res.json({ success: true, product: results[0] });
    });
});

// --- 9. TRANSACTIONS & REPORTS ---
app.get('/transactions', isAuthenticated, (req, res) => {
    const transactions = [
        { id: 1, product: 'Laptop HP ProBook', user: 'Sarah Cashier', type: 'Sale', qty: 2, amount: '$1799.98', date: 'Dec 28, 2025 10:30' },
        { id: 2, product: 'Wireless Mouse', user: 'Sarah Cashier', type: 'Sale', qty: 5, amount: '$149.95', date: 'Dec 28, 2025 11:15' },
        { id: 3, product: 'Notebook Pack (10pcs)', user: 'John Manager', type: 'Stock In', qty: 50, amount: '-', date: 'Dec 27, 2025 14:20' }
    ];
    res.render('transactions', { user: req.session.user, records: transactions });
});

app.get('/reports', isAuthenticated, (req, res) => {
    const reportStats = {
        totalRevenue: '$2689.88',
        totalTransactions: 5,
        avgOrderValue: '$537.98'
    };
    res.render('reports', { user: req.session.user, stats: reportStats });
});

// --- 10. USER MANAGEMENT ---
app.get('/users', isAuthenticated, (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        res.render('users', { user: req.session.user, users: results });
    });
});

app.post('/users/add', isAuthenticated, (req, res) => {
    const { name, username, role, password } = req.body;
    // Default password '1234' if none provided for safety
    const pass = password || '1234'; 
    const sql = "INSERT INTO users (name, username, role, password) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [name, username, role, pass], (err) => {
        if (err) return res.status(500).send("Error adding user: " + err.message);
        res.redirect('/users');
    });
});

// --- 11. START SERVER ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n--- System Active ---`);
    console.log(`URL: http://localhost:${PORT}`);
});