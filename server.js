const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

// 创建Express应用
const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// 连接Neon PostgreSQL数据库
const sequelize = new Sequelize('postgresql://neondb_owner:npg_0pxFEPRmk8TL@ep-mute-band-ad19b2wn-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require', {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // 对于某些云数据库可能需要此设置
    }
  }
});

// 测试数据库连接
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Neon PostgreSQL数据库连接成功');
  } catch (error) {
    console.error('Neon PostgreSQL数据库连接失败:', error);
  }
}

testConnection();

// 用户模型
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// 番茄钟记录模型
const Pomodoro = sequelize.define('Pomodoro', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  taskName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  taskNotes: {
    type: DataTypes.TEXT
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  startTime: {
    type: DataTypes.DATE
  },
  endTime: {
    type: DataTypes.DATE
  }
});

// 设置关联
User.hasMany(Pomodoro, { foreignKey: 'userId' });
Pomodoro.belongsTo(User, { foreignKey: 'userId' });

// 同步模型到数据库
(async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('数据库模型同步成功');
  } catch (error) {
    console.error('数据库模型同步失败:', error);
  }
})();

// 注册路由
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 创建新用户
    const newUser = await User.create({
      username,
      password: hashedPassword
    });

    // 生成JWT令牌
    const token = jwt.sign({ id: newUser.id }, 'your_jwt_secret', { expiresIn: '1d' });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登录路由
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 检查用户是否存在
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '用户名或密码错误' });
    }

    // 生成JWT令牌
    const token = jwt.sign({ id: user.id }, 'your_jwt_secret', { expiresIn: '1d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取用户的番茄钟记录
app.get('/api/pomodoros', authenticateToken, async (req, res) => {
  try {
    const pomodoros = await Pomodoro.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json(pomodoros);
  } catch (error) {
    console.error('获取番茄钟记录失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建番茄钟记录
app.post('/api/pomodoros', authenticateToken, async (req, res) => {
  try {
    const { taskName, taskNotes, duration, completed, startTime, endTime } = req.body;

    const newPomodoro = await Pomodoro.create({
      userId: req.user.id,
      taskName,
      taskNotes,
      duration,
      completed,
      startTime,
      endTime
    });

    res.status(201).json(newPomodoro);
  } catch (error) {
    console.error('创建番茄钟记录失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新番茄钟记录
app.put('/api/pomodoros/:id', authenticateToken, async (req, res) => {
  try {
    const { taskName, taskNotes, duration, completed, startTime, endTime } = req.body;

    const pomodoro = await Pomodoro.findByPk(req.params.id);

    if (!pomodoro) {
      return res.status(404).json({ message: '番茄钟记录不存在' });
    }

    // 确保用户只能更新自己的记录
    if (pomodoro.userId !== req.user.id) {
      return res.status(403).json({ message: '无权访问' });
    }

    await pomodoro.update({
      taskName: taskName || pomodoro.taskName,
      taskNotes: taskNotes || pomodoro.taskNotes,
      duration: duration || pomodoro.duration,
      completed: completed !== undefined ? completed : pomodoro.completed,
      startTime: startTime || pomodoro.startTime,
      endTime: endTime || pomodoro.endTime
    });

    res.json(pomodoro);
  } catch (error) {
    console.error('更新番茄钟记录失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// JWT认证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ message: '未授权访问' });

  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) return res.status(403).json({ message: '令牌无效' });

    req.user = user;
    next();
  });
}

// 服务静态文件
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});