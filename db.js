// 数据库交互模块 - 通过API与后端通信
class DatabaseManager {
  constructor() {
    this.currentUser = null;
    this.userId = null;
    this.apiBaseUrl = 'https://fqclock.top/api';
  }

  // 设置当前用户
  setCurrentUser(username, userId) {
    this.currentUser = username;
    this.userId = userId;
    localStorage.setItem('currentUser', username);
    localStorage.setItem('userId', userId);
  }

  // 获取当前用户
  getCurrentUser() {
    if (!this.currentUser) {
      this.currentUser = localStorage.getItem('currentUser');
      this.userId = localStorage.getItem('userId');
    }
    return this.currentUser;
  }

  // 获取用户ID
  getUserId() {
    if (!this.userId) {
      this.userId = localStorage.getItem('userId');
    }
    return this.userId;
  }

  // 清除当前用户
  clearCurrentUser() {
    this.currentUser = null;
    this.userId = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
  }

  // 初始化
  async init() {
    // 从localStorage恢复用户状态
    this.currentUser = localStorage.getItem('currentUser');
    this.userId = localStorage.getItem('userId');
  
    // 如果有保存的用户，但userId不存在，尝试重新登录
    if (this.currentUser && !this.userId) {
      await this.validateUser(this.currentUser);
    }
  
    console.log('数据库交互模块初始化完成');
    return true;
  }

  // 验证用户（登录）
  async validateUser(username) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();
      if (data.success) {
        this.setCurrentUser(username, data.user.id);
        return true;
      } else {
        console.error('用户验证失败:', data.message);
        return false;
      }
    } catch (error) {
      console.error('登录请求失败:', error);
      return false;
    }
  }

  // 从数据库加载用户数据
  async loadUserData() {
    const userId = this.getUserId();
    if (!userId) {
      console.error('没有登录用户');
      return { tasks: [], reviews: [] };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/user-data/${userId}`);
      const data = await response.json();

      if (data.success) {
        // 转换日期格式，确保前端能正确处理
        const tasks = data.tasks.map(task => ({
          ...task,
          completedAt: task.completed_at ? task.completed_at.toISOString() : null
        }));

        const reviews = data.reviews.map(review => ({
          ...review,
          reviewDate: review.review_date ? review.review_date.toISOString() : null
        }));

        return { tasks, reviews };
      } else {
        console.error('加载用户数据失败:', data.message);
        return { tasks: [], reviews: [] };
      }
    } catch (error) {
      console.error('加载用户数据请求失败:', error);
      return { tasks: [], reviews: [] };
    }
  }

  // 保存用户数据到数据库
  async saveUserData(tasks, reviews) {
    const userId = this.getUserId();
    if (!userId) {
      console.error('没有登录用户');
      return false;
    }

    // 转换日期格式，确保后端能正确处理
    const formattedTasks = tasks.map(task => ({
      ...task,
      completed_at: task.completedAt ? new Date(task.completedAt) : null
    }));

    const formattedReviews = reviews.map(review => ({
      ...review,
      review_date: review.reviewDate ? new Date(review.reviewDate) : null
    }));

    try {
      const response = await fetch(`${this.apiBaseUrl}/save-data/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks: formattedTasks, reviews: formattedReviews }),
      });

      const data = await response.json();
      if (data.success) {
        console.log('数据保存成功');
        return true;
      } else {
        console.error('保存用户数据失败:', data.message);
        // 尝试保存到本地存储作为备选
        localStorage.setItem('tasks', JSON.stringify(tasks));
        localStorage.setItem('reviews', JSON.stringify(reviews));
        return false;
      }
    } catch (error) {
      console.error('保存用户数据请求失败:', error);
      // 尝试保存到本地存储作为备选
      localStorage.setItem('tasks', JSON.stringify(tasks));
      localStorage.setItem('reviews', JSON.stringify(reviews));
      return false;
    }
  }
}

// 创建数据库管理器实例
const dbManager = new DatabaseManager();


export default dbManager;
