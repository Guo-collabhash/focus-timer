// 后端服务器
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

// 内存存储作为数据库连接失败的备选方案
const inMemoryStorage = {
  users: [],
  tasks: [],
  reviews: []
};

// 检查是否使用内存存储
let useInMemoryStorage = false;

// 创建Express应用
const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// 配置PostgreSQL连接池
// 注意：请确保PostgreSQL服务器已启动，并且这些凭证正确
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_0pxFEPRmk8TL@ep-mute-band-ad19b2wn-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: {
    rejectUnauthorized: true
  }
});
host: 'localhost',
  port: 5432,
  database: 'focus',
  user: 'postgres', // 默认PostgreSQL用户
  password: 'password', // 默认密码，请根据你的实际配置修改
});

// 测试数据库连接
pool.connect()
  .then(() => {
    console.log('成功连接到PostgreSQL数据库');
    useInMemoryStorage = false;
    // 初始化数据库表
    initializeDatabase();
  })
  .catch(err => {
    console.error('数据库连接失败:', err);
    console.error('切换到内存存储模式');
    useInMemoryStorage = true;
  });

// 确保表存在
async function initializeDatabase() {
  if (useInMemoryStorage) return;

  try {
    // 创建users表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建tasks表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        notes TEXT,
        planned_minutes INTEGER NOT NULL,
        actual_minutes INTEGER NOT NULL,
        completed_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建reviews表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(50) PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        task_id VARCHAR(50) NOT NULL,
        task_name VARCHAR(255) NOT NULL,
        task_notes TEXT,
        days_later INTEGER NOT NULL,
        review_date TIMESTAMP NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('数据库表初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

// 初始化数据库
initializeDatabase();

// API路由

// 用户登录
app.post('/api/login', async (req, res) => {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ success: false, message: '用户名不能为空' });
  }

  const trimmedUsername = username.trim();

  try {
    if (useInMemoryStorage) {
      // 使用内存存储
      let user = inMemoryStorage.users.find(u => u.username === trimmedUsername);

      if (!user) {
        // 创建新用户
        user = {
          id: Date.now().toString(), // 简单生成唯一ID
          username: trimmedUsername,
          created_at: new Date()
        };
        inMemoryStorage.users.push(user);
      }

      res.json({ success: true, user });
    } else {
      // 使用PostgreSQL
      const result = await pool.query(
        'INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET username = $1 RETURNING id, username',
        [trimmedUsername]
      );

      const user = result.rows[0];
      res.json({ success: true, user });
    }
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败，请重试' });
  }
});

// 获取用户数据
app.get('/api/user-data/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    if (useInMemoryStorage) {
      // 使用内存存储
      const tasks = inMemoryStorage.tasks.filter(task => task.user_id === userId);
      const reviews = inMemoryStorage.reviews.filter(review => review.user_id === userId);

      res.json({
        success: true,
        tasks,
        reviews
      });
    } else {
      // 使用PostgreSQL
      // 获取任务
      const tasksResult = await pool.query('SELECT * FROM tasks WHERE user_id = $1', [userId]);
      // 获取复习记录
      const reviewsResult = await pool.query('SELECT * FROM reviews WHERE user_id = $1', [userId]);

      res.json({
        success: true,
        tasks: tasksResult.rows,
        reviews: reviewsResult.rows
      });
    }
  } catch (error) {
    console.error('获取用户数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败，请重试' });
  }
});

// 保存用户数据
app.post('/api/save-data/:userId', async (req, res) => {
  const { userId } = req.params;
  const { tasks, reviews } = req.body;

  if (!tasks || !reviews) {
    return res.status(400).json({ success: false, message: '数据不完整' });
  }

  try {
    if (useInMemoryStorage) {
      // 使用内存存储
      // 删除旧数据
      inMemoryStorage.tasks = inMemoryStorage.tasks.filter(task => task.user_id !== userId);
      inMemoryStorage.reviews = inMemoryStorage.reviews.filter(review => review.user_id !== userId);

      // 添加新数据
      tasks.forEach(task => {
        inMemoryStorage.tasks.push({
          ...task,
          user_id: userId
        });
      });

      reviews.forEach(review => {
        inMemoryStorage.reviews.push({
          ...review,
          user_id: userId
        });
      });

      res.json({ success: true, message: '数据已保存到内存存储' });
    } else {
      // 使用PostgreSQL
      // 开始事务
      await pool.query('BEGIN');

      try {
        // 删除旧数据
        await pool.query('DELETE FROM tasks WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM reviews WHERE user_id = $1', [userId]);

        // 插入新任务
        for (const task of tasks) {
          await pool.query(
            'INSERT INTO tasks (id, user_id, name, notes, planned_minutes, actual_minutes, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [task.id, userId, task.name, task.notes, task.planned_minutes, task.actual_minutes, task.completed_at]
          );
        }

        // 插入新复习记录
        for (const review of reviews) {
          await pool.query(
            'INSERT INTO reviews (id, user_id, task_id, task_name, task_notes, days_later, review_date, completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [review.id, userId, review.task_id, review.task_name, review.task_notes, review.days_later, review.review_date, review.completed]
          );
        }

        // 提交事务
        await pool.query('COMMIT');
        res.json({ success: true, message: '数据已保存到数据库' });
      } catch (error) {
        // 回滚事务
        await pool.query('ROLLBACK');
        console.error('保存数据失败:', error);
        res.status(500).json({ success: false, message: '保存数据失败，请重试' });
      }
    }
  } catch (error) {
    console.error('保存用户数据失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`请在浏览器中打开 http://localhost:${PORT}`);
});

// 注意：这只是一个开发环境的简单服务器示例
// 在生产环境中，你需要添加更多的安全措施，如身份验证、输入验证等
// 并且不应该将数据库凭证硬编码在代码中，而应该使用环境变量