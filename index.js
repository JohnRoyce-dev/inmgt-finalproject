const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

// Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Default XAMPP/MySQL username
    password: '',      // Default XAMPP password (leave empty)
    database: 'inventory_db'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database!');
});

// Dashboard Route - Real-time dashboards (Requirement vii)
app.get('/', (req, res) => {
    const query = `
        SELECT 
            (SELECT COUNT(*) FROM products) AS total_products,
            (SELECT SUM(quantity) FROM transactions WHERE transaction_type='Sale') AS total_sold,
            (SELECT COUNT(*) FROM products WHERE stock_quantity < 10) AS low_stock_alerts
    `;
    
    db.query(query, (err, stats) => {
        db.query('SELECT * FROM products', (err, products) => {
            res.render('dashboard', { stats: stats[0], products: products });
        });
    });
});

// Handle Sale Transaction (Requirement v)
app.post('/sell', (req, res) => {
    const { product_id, quantity } = req.body;
    
    // Record transaction and update stock automatically
    db.query('INSERT INTO transactions (product_id, transaction_type, quantity) VALUES (?, "Sale", ?)', 
    [product_id, quantity], (err) => {
        db.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?', 
        [quantity, product_id], (err) => {
            res.redirect('/');
        });
    });
});

app.listen(3000, () => console.log('Server started at http://localhost:3000'));

// Route to Add a New Product (Requirement iii)
app.post('/add-product', (req, res) => {
    const { product_name, barcode, category, price, stock_quantity } = req.body;
    const query = 'INSERT INTO products (product_name, barcode, category, price, stock_quantity) VALUES (?, ?, ?, ?, ?)';
    
    db.query(query, [product_name, barcode, category, price, stock_quantity], (err) => {
        if (err) {
            console.error(err);
            return res.send("Error adding product. Barcode might be a duplicate.");
        }
        res.redirect('/'); // Refresh the page to see the new product
    });
});