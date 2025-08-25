// api/user-data/[userId].js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  const { userId } = req.query;

  try {
    const tasks = await pool.query('SELECT * FROM tasks WHERE user_id=$1', [userId]);
    const reviews = await pool.query('SELECT * FROM reviews WHERE user_id=$1', [userId]);
    res.json({ success: true, tasks: tasks.rows, reviews: reviews.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
}