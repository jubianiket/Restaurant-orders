const { Pool } = require('pg');

const pool = new Pool({
  host: 'dpg-d0unlommcj7s73a21fa0-a.oregon-postgres.render.com',
  user: 'rjy_db_f8ky_user',
  password: 'lSXyc6zPe0XUJjAY7IRC0i9IXldwB87f',
  database: 'rjy_db_f8ky',
  port: 5432,
  ssl: {
    rejectUnauthorized: false, // Required for Render's SSL
  },
});

module.exports = pool;
