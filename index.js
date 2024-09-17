require('dotenv').config();

const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection setup
const pool = new Pool({
    connectionString: process.env.POSTGRESQL_URL,
});

// Middleware to handle CORS
app.use(cors());

// Function to create the `crypto_data` table if it doesn't exist
async function createTableIfNotExists() {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS crypto_data (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        last NUMERIC NOT NULL,
        buy NUMERIC NOT NULL,
        sell NUMERIC NOT NULL,
        volume NUMERIC NOT NULL,
        base_unit TEXT NOT NULL
    );`;

    try {
        await pool.query(createTableQuery);
        console.log('Table `crypto_data` is ready.');
    } catch (error) {
        console.error('Error creating table:', error);
    }
}

// Fetch crypto data from WazirX API and store in PostgreSQL
async function fetchAndStoreCryptoData() {
    try {
        const response = await axios.get('https://api.wazirx.com/api/v2/tickers');
        const tickers = response.data;
        const keys = Object.keys(tickers).slice(0, 10); // Get top 10 results

        await pool.query('DELETE FROM crypto_data'); // Clear previous data

        const insertQuery = `INSERT INTO crypto_data (name, last, buy, sell, volume, base_unit) VALUES ($1, $2, $3, $4, $5, $6)`;

        // Loop through the top 10 crypto tickers
        for (const key of keys) {
            const ticker = tickers[key];
            const name = key;
            const last = parseFloat(ticker.last);
            const buy = parseFloat(ticker.buy);
            const sell = parseFloat(ticker.sell);
            const volume = parseFloat(ticker.volume);
            const base_unit = ticker.base_unit;

            // Insert data into PostgreSQL
            await pool.query(insertQuery, [name, last, buy, sell, volume, base_unit]);
        }
    } catch (error) {
        console.error('Error fetching or storing crypto data:', error);
    }
}

// API route to get crypto data from PostgreSQL
app.get('/api/crypto', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM crypto_data');
        res.json(result.rows);
    } catch (error) {
        console.error('Error retrieving data from PostgreSQL:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Initial setup: Create the table and fetch data
(async () => {
    await createTableIfNotExists();
    await fetchAndStoreCryptoData();
})();

// Refresh data every minute
setInterval(fetchAndStoreCryptoData, 60000); // Refresh data every minute

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
