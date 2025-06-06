const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'NisargR',
  password: 'Qwerty@123',
  port: 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(), // ✅ Add this line
};