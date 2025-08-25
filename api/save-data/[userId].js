// api/save-data/[userId].js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId } = req.query;
  const { tasks, reviews } = req.body;

  try {
    await pool.query('BEGIN');

    await pool.query('DELETE FROM tasks WHERE user_id=$1', [userId]);
    await pool.query('DELETE FROM reviews WHERE user_id=$1', [userId]);

    for (const t of tasks) {
      await pool.query(
        `INSERT INTO tasks(id,user_id,name,notes,planned_minutes,actual_minutes,completed_at)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [t.id, userId, t.name, t.notes, t.planned_minutes, t.actual_minutes, t.completed_at]
      );
    }

    for (const r of reviews) {
      await pool.query(
        `INSERT INTO reviews(id,user_id,task_id,task_name,task_notes,days_later,review_date,completed)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [r.id, userId, r.task_id, r.task_name, r.task_notes, r.days_later, r.review_date, r.completed]
      );
    }

    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: '保存失败' });
  }
}