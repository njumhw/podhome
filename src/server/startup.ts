// 应用启动初始化
import { taskQueue } from "./task-queue";

export function initializeApp() {
  console.log('🚀 初始化应用...');
  
  // 启动后台任务处理器
  taskQueue.startProcessing();
  
  console.log('✅ 应用初始化完成');
}

// 在服务器端自动启动
if (typeof window === 'undefined') {
  // 延迟启动，确保数据库连接已建立
  setTimeout(() => {
    initializeApp();
  }, 2000);
}
