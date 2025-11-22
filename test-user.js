const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

async function createTestUser() {
  try {
    console.log('创建测试用户...');
    
    // 删除现有用户
    await prisma.user.deleteMany({
      where: { email: 'test@example.com' }
    });
    
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: hashPassword('test123'),
        role: 'ADMIN'
      }
    });
    
    console.log('测试用户创建成功:', user);
    
    // 测试登录
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: 'test@example.com',
        password: 'test123'
      })
    });
    
    const loginResult = await loginResponse.json();
    console.log('登录结果:', loginResult);
    console.log('登录状态码:', loginResponse.status);
    console.log('登录响应头:', loginResponse.headers);
    
    if (loginResult.token) {
      // 测试播客处理
      const processResponse = await fetch('http://localhost:3000/api/process-audio-async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginResult.token}`
        },
        body: JSON.stringify({
          url: 'https://www.xiaoyuzhoufm.com/episode/68ff93db01567203214fd158'
        })
      });
      
      const processResult = await processResponse.json();
      console.log('处理结果:', processResult);
    }
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
