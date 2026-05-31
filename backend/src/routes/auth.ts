import { Router, Request, Response, NextFunction } from 'express';
import { findAll, findWhere, create, update, remove } from '../db/jsonDb';
import crypto from 'crypto';
import { getSystemSettingBoolean, setSystemSettingBoolean } from '../utils/systemSettings';

const router = Router();

// 简单密码哈希（轻量级方案，生产环境应使用 bcrypt）
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_guzhang_salt_2026').digest('hex');
}

// 生成简单 token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// 管理员权限验证中间件
function adminOnly(req: Request, res: Response, next: NextFunction) {
  const username = req.headers['x-username'] as string;
  if (!username) {
    return res.status(401).json({ error: '未登录' });
  }

  const users = findAll<any>('users');
  const user = users.find((u: any) => u.username === username) as any;

  if (!user) {
    return res.status(401).json({ error: '用户不存在' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }

  next();
}

// 注册
router.post('/register', async (req, res) => {
  try {
    // 检查注册是否关闭
    const settings = findAll<any>('systemSettings');
    const registrationDisabled = settings.find((s: any) => s.key === 'registrationDisabled');
    if (registrationDisabled && registrationDisabled.value === true) {
      return res.status(403).json({ error: '注册功能已关闭，请联系管理员' });
    }

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

    // 如果用户表为空，第一个注册的用户为管理员
    const role = existingUsers.length === 0 ? 'admin' : 'user';

    // 创建用户
    const user = create('users', {
      username,
      password: hashPassword(password),
      nickname: nickname || username,
      avatar: '',
      role,
      disabled: false,
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

    if (user.disabled) {
      return res.status(403).json({ error: '账户已被禁用，请联系管理员' });
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

// ========== 用户管理 API（仅管理员） ==========

// 获取所有用户列表
router.get('/users', adminOnly, async (req, res) => {
  try {
    const users = findAll<any>('users');
    // 返回用户信息（不含密码）
    const userList = users.map((u: any) => {
      const { password: _, ...userInfo } = u;
      return userInfo;
    });
    res.json({ success: true, users: userList });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 更新用户（禁用/启用）
router.put('/users/:id', adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { disabled } = req.body;

    const currentUsername = req.headers['x-username'] as string;
    const users = findAll<any>('users');
    const targetUser = users.find((u: any) => u.id === userId) as any;

    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 不能禁用/启用自己
    if (targetUser.username === currentUsername) {
      return res.status(400).json({ error: '不能修改自己的状态' });
    }

    // 不能禁用其他管理员
    if (targetUser.role === 'admin' && disabled) {
      return res.status(400).json({ error: '不能禁用管理员账户' });
    }

    const updatedUser = update('users', userId, { disabled: !!disabled }) as any;
    if (!updatedUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const { password: _, ...userInfo } = updatedUser;
    res.json({ success: true, user: userInfo });
  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({ error: '更新用户失败' });
  }
});

// 删除用户
router.delete('/users/:id', adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUsername = req.headers['x-username'] as string;

    const users = findAll<any>('users');
    const targetUser = users.find((u: any) => u.id === userId) as any;

    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 不能删除自己
    if (targetUser.username === currentUsername) {
      return res.status(400).json({ error: '不能删除自己' });
    }

    // 不能删除其他管理员
    if (targetUser.role === 'admin') {
      return res.status(400).json({ error: '不能删除管理员账户' });
    }

    const deleted = remove('users', userId);
    if (!deleted) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

export { router as authRouter };

// ========== 系统设置 API（仅管理员） ==========

// 获取系统设置
router.get('/settings', adminOnly, async (req, res) => {
  try {
    const registrationDisabled = getSystemSettingBoolean('registrationDisabled', false);
    const deduplicationEnabled = getSystemSettingBoolean('deduplicationEnabled', true);
    res.json({
      success: true,
      settings: {
        registrationDisabled,
        deduplicationEnabled,
      },
    });
  } catch (error) {
    console.error('获取系统设置失败:', error);
    res.status(500).json({ error: '获取系统设置失败' });
  }
});

// 更新系统设置
router.put('/settings', adminOnly, async (req, res) => {
  try {
    const { registrationDisabled, deduplicationEnabled } = req.body;
    const updatedKeys: string[] = [];

    if (registrationDisabled !== undefined) {
      setSystemSettingBoolean('registrationDisabled', !!registrationDisabled);
      updatedKeys.push('registrationDisabled');
    }

    if (deduplicationEnabled !== undefined) {
      setSystemSettingBoolean('deduplicationEnabled', !!deduplicationEnabled);
      updatedKeys.push('deduplicationEnabled');
    }

    if (updatedKeys.length === 0) {
      return res.status(400).json({ error: '未提供可更新的系统设置' });
    }

    res.json({
      success: true,
      message: '系统设置已更新',
      settings: {
        registrationDisabled: getSystemSettingBoolean('registrationDisabled', false),
        deduplicationEnabled: getSystemSettingBoolean('deduplicationEnabled', true),
      },
    });
  } catch (error) {
    console.error('更新系统设置失败:', error);
    res.status(500).json({ error: '更新系统设置失败' });
  }
});
