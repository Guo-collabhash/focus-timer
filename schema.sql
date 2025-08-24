-- 创建扩展（如果需要）
-- 注意：当前代码使用PostgreSQL内置的gen_random_uuid()函数，而不是uuid-ossp扩展
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建users表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建tasks表
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(50) PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    notes TEXT,
    planned_minutes INTEGER NOT NULL,
    actual_minutes INTEGER NOT NULL,
    completed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建reviews表
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
);