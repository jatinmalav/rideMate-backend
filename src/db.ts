import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') 
    ? false 
    : { rejectUnauthorized: false } // Required for Supabase
});
async function testDbConnection() {
  const result = await pool.query("SELECT 1");
  return result.rows;
}

export { pool, testDbConnection };