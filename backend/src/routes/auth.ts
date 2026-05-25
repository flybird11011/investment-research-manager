import { Router } from 'express';
import { findAll, findWhere, create } from '../db/jsonDb';
import crypto from 'crypto';

const router = Router();

// 简单密码哈希（轻量级方案，生产环境应使用 bcrypt）
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_guzhang_salt_2026').digest('hex');
}

// 生成简单 token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: '用户名至少3个字符' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }

    // 检查用户名是否已存在
    const existingUsers = findAll<any>('users');
    const exists = existingUsers.find((u: any) => u.username === username);
    if (exists) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    // 创建用户
    const user = create('users', {
      username,
      password: hashPassword(password),
      nickname: nickname || username,
      avatar: '',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    }) as any;

    // 返回用户信息（不含密码）
    const { password: _, ...userInfo } = user;
    res.status(201).json({
      success: true,
      message: '注册成功',
      user: userInfo,
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const users = findAll<any>('users');
    const user = users.find((u: any) => u.username === username) as any;

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (user.password !== hashPassword(password)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成 token
    const token = generateToken();

    // 更新最后登录时间
    const { password: _, ...userInfo } = user;
    userInfo.lastLoginAt = new Date().toISOString();

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: userInfo,
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未登录' });
    }

    // 简单 token 验证：从请求头获取用户名
    const username = req.headers['x-username'] as string;
    if (!username) {
      return res.status(401).json({ error: '未登录' });
    }

    const users = findAll<any>('users');
    const user = users.find((u: any) => u.username === username) as any;

    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    const { password: _, ...userInfo } = user;
    res.json({ user: userInfo });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

export { router as authRouter };
