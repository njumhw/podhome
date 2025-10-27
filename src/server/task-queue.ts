// 后台任务队列系统
import { db } from "@/server/db";

export interface Task {
  id: string;
  type: 'PODCAST_PROCESSING';
  status: 'PENDING' | 'RUNNING' | 'READY' | 'FAILED';
  data: {
    url: string;
    userId?: string;
    audioUrl?: string;
    title?: string;
    author?: string;
  };
  result?: any;
  error?: string;
  metrics?: {
    audioDuration?: number; // 音频时长（秒）
    asrSegmentsCount?: number; // 成功转写的ASR段落数
    chunksCount?: number; // 分块数
    transcriptCompressionRatio?: number; // 访谈原文压缩比
    reportCompressionRatio?: number; // 播客报告压缩比
    processingSteps?: {
      asr?: { status: 'pending' | 'running' | 'completed' | 'failed'; duration?: number };
      cleaning?: { status: 'pending' | 'running' | 'completed' | 'failed'; duration?: number };
      report?: { status: 'pending' | 'running' | 'completed' | 'failed'; duration?: number };
    };
  };
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

class TaskQueue {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private maxConcurrentTasks = 3; // 最大并发任务数
  private runningTasks = new Set<string>(); // 正在运行的任务ID
  private isInitialized = false; // 添加初始化标志
  private retryAttempts = new Map<string, number>(); // 重试次数记录
  private maxRetries = 3; // 最大重试次数
  private retryDelay = 5000; // 重试延迟（毫秒）
  private connectionRetryDelay = 10000; // 数据库连接重试延迟
  private maxTaskDuration = 180 * 60 * 1000; // 最大任务运行时间：3小时
  private taskStartTimes = new Map<string, number>(); // 任务开始时间记录

  // 初始化方法
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // 测试数据库连接
      await db.taskQueue.count();
      this.isInitialized = true;
      console.log('TaskQueue 初始化成功');
    } catch (error) {
      console.error('TaskQueue 初始化失败:', error);
      // 延迟重试
      setTimeout(() => this.initialize(), this.connectionRetryDelay);
    }
  }

  // 添加任务到队列
  async addTask(taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // 确保已初始化
    if (!this.isInitialized) {
      await this.initialize();
    }

    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'PODCAST_PROCESSING',
      status: 'PENDING',
      data: taskData.data,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      // 保存到数据库
      await db.taskQueue.create({
        data: {
          id: task.id,
          type: task.type,
          status: task.status,
          data: task.data,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        }
      });

      console.log(`任务已添加到队列: ${task.id}`);
      
      // 启动处理（如果还没有在处理）
      this.startProcessing();
      
      return task.id;
    } catch (error) {
      console.error('添加任务失败:', error);
      throw error;
    }
  }

  // 获取任务状态
  async getTaskStatus(taskId: string): Promise<Task | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const taskRecord = await db.taskQueue.findUnique({
        where: { id: taskId }
      });

      if (!taskRecord) return null;

      return {
        id: taskRecord.id,
        type: taskRecord.type as 'PODCAST_PROCESSING',
        status: taskRecord.status as 'PENDING' | 'RUNNING' | 'READY' | 'FAILED',
        data: taskRecord.data as any,
        result: taskRecord.result as any,
        error: taskRecord.error || undefined,
        metrics: taskRecord.metrics as any,
        createdAt: taskRecord.createdAt,
        updatedAt: taskRecord.updatedAt,
        startedAt: taskRecord.startedAt || undefined,
        completedAt: taskRecord.completedAt || undefined
      };
    } catch (error) {
      console.error('获取任务状态失败:', error);
      return null;
    }
  }

  // 通过URL获取任务
  async getTaskByUrl(url: string): Promise<Task | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const taskRecord = await db.taskQueue.findFirst({
        where: {
          data: {
            path: ['url'],
            equals: url
          }
        },
        orderBy: {
          createdAt: 'desc' // 获取最新的任务
        }
      });

      if (!taskRecord) return null;

      return {
        id: taskRecord.id,
        type: taskRecord.type as 'PODCAST_PROCESSING',
        status: taskRecord.status as 'PENDING' | 'RUNNING' | 'READY' | 'FAILED',
        data: taskRecord.data as any,
        result: taskRecord.result as any,
        error: taskRecord.error || undefined,
        metrics: taskRecord.metrics as any,
        createdAt: taskRecord.createdAt,
        updatedAt: taskRecord.updatedAt,
        startedAt: taskRecord.startedAt || undefined,
        completedAt: taskRecord.completedAt || undefined
      };
    } catch (error) {
      console.error('通过URL获取任务失败:', error);
      return null;
    }
  }

  // 获取队列状态
  async getQueueStatus() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const [pending, running, completed, failed] = await Promise.all([
        db.taskQueue.count({ where: { status: 'PENDING' } }),
        db.taskQueue.count({ where: { status: 'RUNNING' } }),
        db.taskQueue.count({ where: { status: 'READY' } }),
        db.taskQueue.count({ where: { status: 'FAILED' } })
      ]);

      return {
        pending,
        running,
        completed,
        failed,
        maxConcurrent: this.maxConcurrentTasks,
        currentConcurrent: this.runningTasks.size
      };
    } catch (error) {
      console.error('获取队列状态失败:', error);
      return {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        maxConcurrent: this.maxConcurrentTasks,
        currentConcurrent: this.runningTasks.size
      };
    }
  }

  // 启动后台处理
  startProcessing() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processingInterval = setInterval(async () => {
      await this.processNextTask();
    }, 5000); // 每5秒检查一次

    console.log('后台任务处理器已启动');
  }

  // 停止后台处理
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    console.log('后台任务处理器已停止');
  }

  // 处理下一个任务
  private async processNextTask() {
    try {
      // 确保已初始化
      if (!this.isInitialized) {
        await this.initialize();
        return;
      }

      // 检查运行中的任务是否超时
      await this.checkTaskTimeouts();

      // 检查是否已达到最大并发数
      if (this.runningTasks.size >= this.maxConcurrentTasks) {
        return;
      }

      // 查找下一个待处理的任务
      const nextTask = await db.taskQueue.findFirst({
        where: {
          status: 'PENDING'
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      if (!nextTask) return;

      // 检查重试次数
      const retryCount = this.retryAttempts.get(nextTask.id) || 0;
      if (retryCount >= this.maxRetries) {
        console.log(`任务 ${nextTask.id} 重试次数超限，标记为失败`);
        await this.markTaskFailed(nextTask.id, '重试次数超限');
        return;
      }

      // 添加到运行中任务集合
      this.runningTasks.add(nextTask.id);
      this.retryAttempts.set(nextTask.id, retryCount + 1);

      console.log(`开始处理任务: ${nextTask.id} (并发数: ${this.runningTasks.size}/${this.maxConcurrentTasks})`);

      // 更新任务状态为运行中
      await db.taskQueue.update({
        where: { id: nextTask.id },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // 记录任务开始时间
      this.taskStartTimes.set(nextTask.id, Date.now());

      // 异步执行任务，不等待完成
      this.executeTask(nextTask).finally(() => {
        // 任务完成后从运行中任务集合移除
        this.runningTasks.delete(nextTask.id);
        this.taskStartTimes.delete(nextTask.id);
      });

    } catch (error) {
      console.error('处理任务时出错:', error);
      
      // 如果是数据库连接错误，尝试重新初始化
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('database') || errorMessage.includes('connection')) {
        console.log('检测到数据库连接问题，尝试重新初始化');
        this.isInitialized = false;
        setTimeout(() => this.initialize(), this.connectionRetryDelay);
      }
    }
  }

  // 执行具体任务
  private async executeTask(taskRecord: any) {
    try {
      if (taskRecord.type === 'PODCAST_PROCESSING') {
        await this.processPodcastTask(taskRecord);
      }
    } catch (error) {
      console.error(`任务执行失败: ${taskRecord.id}`, error);
      
      // 检查是否是数据库连接错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('database') || errorMessage.includes('connection')) {
        console.log(`任务 ${taskRecord.id} 遇到数据库连接问题，等待重试`);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return; // 不标记为失败，等待重试
      }
      
      // 更新任务状态为失败
      await this.markTaskFailed(taskRecord.id, error instanceof Error ? error.message : String(error));
    }
  }

  // 检查任务超时
  private async checkTaskTimeouts() {
    const now = Date.now();
    const timeoutTasks: string[] = [];

    for (const [taskId, startTime] of this.taskStartTimes.entries()) {
      const runningTime = now - startTime;
      if (runningTime > this.maxTaskDuration) {
        timeoutTasks.push(taskId);
      }
    }

    // 处理超时任务
    for (const taskId of timeoutTasks) {
      console.log(`任务 ${taskId} 运行时间超过 ${this.maxTaskDuration / 1000 / 60} 分钟，强制终止`);
      await this.markTaskFailed(taskId, `任务运行时间超过 ${this.maxTaskDuration / 1000 / 60} 分钟，自动终止`);
      this.runningTasks.delete(taskId);
      this.taskStartTimes.delete(taskId);
    }
  }

  // 标记任务失败
  private async markTaskFailed(taskId: string, error: string) {
    try {
      await db.taskQueue.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          error,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log(`任务 ${taskId} 已标记为失败: ${error}`);
    } catch (updateError) {
      console.error('标记任务失败时出错:', updateError);
    }
  }

  // 处理播客任务
  private async processPodcastTask(taskRecord: any) {
    const { url, userId } = taskRecord.data;
    
    try {
      // 这里调用现有的处理逻辑
      // 可以复用现有的 process-audio 逻辑，但改为内部函数调用
      const result = await this.processPodcastInternal(url, userId, taskRecord.id);
      
      // 更新任务状态为完成
      await db.taskQueue.update({
        where: { id: taskRecord.id },
        data: {
          status: 'READY',
          result: result,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`播客处理任务完成: ${taskRecord.id}`);
      
      // 清除重试记录
      this.retryAttempts.delete(taskRecord.id);
      
    } catch (error) {
      throw error; // 让上层处理错误
    }
  }

  // 内部播客处理逻辑（复用现有代码）
  private async processPodcastInternal(url: string, userId?: string, taskId?: string) {
    try {
      // 直接调用现有的处理逻辑，而不是通过HTTP请求
      const { processAudioInternal } = await import('@/server/audio-processor');
      
      // 调用内部处理函数
      const result = await processAudioInternal(url, userId, taskId);
      
      return result;
    } catch (error) {
      console.error('播客处理失败:', error);
      throw error;
    }
  }
}

// 导出单例
export const taskQueue = new TaskQueue();

// 在应用启动时启动任务处理器
if (typeof window === 'undefined') {
  // 只在服务器端启动，延迟初始化
  setTimeout(async () => {
    await taskQueue.initialize();
    taskQueue.startProcessing();
  }, 2000); // 延迟2秒启动，确保数据库连接就绪
}
