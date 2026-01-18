// 后台任务队列系统
import { db } from "@/server/db";
import { dbRetry } from "@/server/db-retry";
import { processAudioInternal } from "@/server/audio-processor";
import { normalizePodcastUrl } from "@/utils/url-normalizer";

export interface Task {
  id: string;
  type: 'PODCAST_PROCESSING';
  status: 'PENDING' | 'RUNNING' | 'READY' | 'FAILED';
  data: {
    url: string;
    userId?: string | null;
    audioUrl?: string;
    title?: string;
    author?: string;
    mulerunSessionId?: string;
    mulerunQueryId?: string;
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
  private maxTaskDuration = 60 * 60 * 1000; // 最大任务运行时间：1小时（降低超时时间，更快发现卡住的任务）
  private taskStartTimes = new Map<string, number>(); // 任务开始时间记录

  // 初始化方法
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // 测试数据库连接
      await dbRetry.taskQueue.count({});
      
      // 清理应用重启后遗留的 RUNNING 状态任务（重置为 PENDING，让它们重新处理）
      await this.resetStaleRunningTasks();
      
      this.isInitialized = true;
      console.log('TaskQueue 初始化成功');
    } catch (error) {
      console.error('TaskQueue 初始化失败:', error);
      // 延迟重试
      setTimeout(() => this.initialize(), this.connectionRetryDelay);
    }
  }

  // 重置应用重启后遗留的 RUNNING 状态任务
  private async resetStaleRunningTasks() {
    try {
      const staleTasks = await dbRetry.taskQueue.findMany({
        where: {
          status: 'RUNNING',
          startedAt: {
            not: null,
            // 运行时间超过5分钟的任务，可能是应用重启后遗留的
            lt: new Date(Date.now() - 5 * 60 * 1000)
          }
        },
        select: {
          id: true,
          startedAt: true,
          createdAt: true
        },
        take: 20
      }) as Array<{ id: string; startedAt: Date | null; createdAt: Date }>;

      if (staleTasks.length > 0) {
        console.log(`🔄 发现 ${staleTasks.length} 个遗留的 RUNNING 状态任务，重置为 PENDING`);
        
        for (const task of staleTasks) {
          const runningTime = task.startedAt 
            ? Math.round((Date.now() - task.startedAt.getTime()) / 1000 / 60)
            : 0;
          
          console.log(`   - 任务 ${task.id}: 已运行 ${runningTime} 分钟，重置为 PENDING`);
          
          await dbRetry.taskQueue.update({
            where: { id: task.id },
            data: {
              status: 'PENDING',
              startedAt: null,
              updatedAt: new Date()
            }
          });
        }
        
        console.log(`✅ 已重置 ${staleTasks.length} 个任务为 PENDING 状态`);
      }
    } catch (error) {
      console.error('重置遗留任务时出错:', error);
    }
  }

  // 添加任务到队列
  async addTask(taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // 确保已初始化
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 检查是否有相同URL的正在运行或待处理的任务（避免重复处理）
    if (taskData.type === 'PODCAST_PROCESSING' && taskData.data?.url) {
      const url = taskData.data.url;
      const { normalizePodcastUrl } = await import('@/utils/url-normalizer');
      const normalizedUrl = normalizePodcastUrl(url);
      
      // 检查是否有相同URL的正在运行或待处理的任务
      const existingTask = await dbRetry.taskQueue.findFirst({
        where: {
          type: 'PODCAST_PROCESSING',
          status: {
            in: ['PENDING', 'RUNNING']
          },
          data: {
            path: ['url'],
            equals: normalizedUrl
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          startedAt: true
        }
      }) as { id: string; status: string; createdAt: Date; startedAt: Date | null } | null;

      if (existingTask) {
        const taskAge = Date.now() - new Date(existingTask.createdAt).getTime();
        const taskAgeMinutes = Math.floor(taskAge / 60000);
        
        // 检查任务是否已经失败（通过查询数据库获取最新状态）
        const latestTask = await dbRetry.taskQueue.findUnique({
          where: { id: existingTask.id },
          select: { status: true, error: true, updatedAt: true }
        }) as { status: string; error: string | null; updatedAt: Date } | null;
        
        // 如果任务已经失败，不返回旧任务ID，允许创建新任务
        if (latestTask && latestTask.status === 'FAILED') {
          console.log(`⚠️ 发现相同URL的任务已失败: ${existingTask.id}, 错误: ${latestTask.error?.substring(0, 100)}...`);
          console.log(`   允许创建新任务`);
          // 不返回旧任务ID，继续创建新任务
        } else if (latestTask && latestTask.error && latestTask.status === 'PENDING') {
          // 如果任务状态是PENDING但有错误信息，说明任务可能已经失败但被重置为PENDING
          // 检查错误信息是否包含"音频下载失败"，如果是，允许创建新任务
          if (latestTask.error.includes('音频下载失败')) {
            console.log(`⚠️ 发现相同URL的任务有错误信息（可能是失败后重置）: ${existingTask.id}, 错误: ${latestTask.error.substring(0, 100)}...`);
            console.log(`   允许创建新任务`);
            // 不返回旧任务ID，继续创建新任务
          } else if (taskAgeMinutes < 30) {
            // 其他错误，如果任务运行时间少于30分钟，返回旧任务ID
            console.log(`⚠️ 发现相同URL的正在处理的任务: ${existingTask.id}, 状态: ${existingTask.status}, 已运行: ${taskAgeMinutes}分钟`);
            return existingTask.id;
          }
        } else if (taskAgeMinutes < 30) {
          // 如果任务运行时间超过30分钟，可能是卡住了，允许创建新任务
          console.log(`⚠️ 发现相同URL的正在处理的任务: ${existingTask.id}, 状态: ${existingTask.status}, 已运行: ${taskAgeMinutes}分钟`);
          // 返回现有任务的ID，而不是创建新任务
          return existingTask.id;
        } else {
          console.log(`⚠️ 发现相同URL的长时间运行的任务（${taskAgeMinutes}分钟），可能是卡住了，允许创建新任务`);
        }
      }
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
      await dbRetry.taskQueue.create({
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
      const taskRecord = await dbRetry.taskQueue.findFirst({
        where: { id: taskId }
      });

      if (!taskRecord) return null;
      const rec: any = taskRecord as any;

      return {
        id: rec.id,
        type: rec.type as 'PODCAST_PROCESSING',
        status: rec.status as 'PENDING' | 'RUNNING' | 'READY' | 'FAILED',
        data: rec.data as any,
        result: rec.result as any,
        error: rec.error || undefined,
        metrics: rec.metrics as any,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        startedAt: rec.startedAt || undefined,
        completedAt: rec.completedAt || undefined
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
      const taskRecord = await dbRetry.taskQueue.findFirst({
        where: {
          data: {
            path: ['url'],
            equals: url
          }
        },
        orderBy: {
          createdAt: 'desc' // 获取最新的任务
        }
      }) as any;

      if (!taskRecord) return null;
      const rec: any = taskRecord as any;

      return {
        id: rec.id,
        type: rec.type as 'PODCAST_PROCESSING',
        status: rec.status as 'PENDING' | 'RUNNING' | 'READY' | 'FAILED',
        data: rec.data as any,
        result: rec.result as any,
        error: rec.error || undefined,
        metrics: rec.metrics as any,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        startedAt: rec.startedAt || undefined,
        completedAt: rec.completedAt || undefined
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
        dbRetry.taskQueue.count({ where: { status: 'PENDING' } }),
        dbRetry.taskQueue.count({ where: { status: 'RUNNING' } }),
        dbRetry.taskQueue.count({ where: { status: 'READY' } }),
        dbRetry.taskQueue.count({ where: { status: 'FAILED' } })
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
      // 只在有任务时才输出日志，避免构建时日志过多
      const nextTask = await dbRetry.taskQueue.findFirst({
        where: {
          status: 'PENDING'
        },
        orderBy: {
          createdAt: 'asc'
        }
      }) as any;

      if (!nextTask) {
        // 无任务时不输出日志，避免构建时日志过多
        return;
      }
      
      // 找到任务时才输出日志
      console.log('[强制日志] 开始查询PENDING状态的任务...');
      
      const nt = nextTask as { id: string; data: any; type: string; status: string };
      console.log('[强制日志] ✅ 找到PENDING任务:', nt.id);
      const taskUrl = (nt.data as any)?.url || '未知';
      // 强制输出日志，确保任务被处理时能看到
      console.log(`[强制日志] 找到待处理任务: ${nt.id}`);
      console.log(`🔍 找到待处理任务: ${nt.id}, URL: ${taskUrl}`);
      console.log(`[强制日志] 任务数据:`, JSON.stringify(nt.data));

      // 检查重试次数
      const retryCount = this.retryAttempts.get(nt.id) || 0;
      if (retryCount >= this.maxRetries) {
        console.log(`任务 ${nt.id} 重试次数超限，标记为失败`);
        await this.markTaskFailed(nt.id, '重试次数超限');
        return;
      }

      // 添加到运行中任务集合
      this.runningTasks.add(nt.id);
      this.retryAttempts.set(nt.id, retryCount + 1);

      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`🚀 开始处理任务: ${nt.id}`);
      console.log(`   并发数: ${this.runningTasks.size}/${this.maxConcurrentTasks}`);
      console.log(`   任务数据:`, JSON.stringify(nt.data, null, 2));
      console.log(`═══════════════════════════════════════════════════════════`);

      // 更新任务状态为运行中
      await dbRetry.taskQueue.update({
        where: { id: nt.id },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          updatedAt: new Date()
        }
      });

      // 记录任务开始时间
      this.taskStartTimes.set(nt.id, Date.now());

      // 异步执行任务，不等待完成
      // 添加详细的错误处理，确保所有错误都被记录
      console.log(`[强制日志] 准备执行任务: ${nt.id}`);
      this.executeTask(nt).catch((error) => {
        // 如果 executeTask 内部没有正确处理错误，这里作为最后的保障
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error(`═══════════════════════════════════════════════════════════`);
        console.error(`⚠️ executeTask 未捕获的错误 (任务 ${nt.id}):`);
        console.error(`   错误信息: ${errorMessage}`);
        console.error(`   错误类型: ${error instanceof Error ? error.name : 'UnknownError'}`);
        if (errorStack) {
          console.error(`   错误堆栈:`, errorStack.substring(0, 2000));
        }
        console.error(`═══════════════════════════════════════════════════════════`);
        
        // 如果 executeTask 没有处理错误，这里标记为失败
        if (!errorMessage.includes('database') && !errorMessage.includes('connection')) {
          let errorToSave = errorMessage;
          if (errorToSave.length > 500) {
            errorToSave = errorToSave.substring(0, 497) + '...';
          }
          this.markTaskFailed(nt.id, errorToSave).catch((markError) => {
            console.error(`❌ 标记任务失败时出错:`, markError);
          });
        }
      }).finally(() => {
        // 任务完成后从运行中任务集合移除
        this.runningTasks.delete(nt.id);
        this.taskStartTimes.delete(nt.id);
        console.log(`[强制日志] 任务 ${nt.id} 已从运行中任务集合移除`);
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
    console.log(`[强制日志] executeTask 开始: ${taskRecord.id}, 类型: ${taskRecord.type}`);
    try {
      if (taskRecord.type === 'PODCAST_PROCESSING') {
        console.log(`[强制日志] 准备处理播客任务: ${taskRecord.id}`);
        await this.processPodcastTask(taskRecord);
        console.log(`[强制日志] 播客任务处理完成: ${taskRecord.id}`);
      } else {
        console.warn(`[强制日志] 未知任务类型: ${taskRecord.type}`);
      }
    } catch (error) {
      console.error(`[强制日志] executeTask 捕获错误: ${taskRecord.id}`);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      // 如果错误信息是简化的 "fetch failed"，尝试从堆栈中提取更多信息
      let detailedErrorMessage = errorMessage;
      if (errorMessage === 'fetch failed' || errorMessage.toLowerCase().includes('fetch failed')) {
        // 尝试从堆栈中提取更多信息
        if (errorStack) {
          const stackLines = errorStack.split('\n');
          const relevantLine = stackLines.find(line => 
            line.includes('parseXiaoyuzhouEpisode') || 
            line.includes('fetchHtml') ||
            line.includes('网络请求失败') ||
            line.includes('fetch')
          );
          if (relevantLine) {
            detailedErrorMessage = `网络请求失败: ${errorMessage} (${relevantLine.trim()})`;
          } else {
            detailedErrorMessage = `网络请求失败: ${errorMessage}。错误类型: ${errorName}。请检查网络连接或稍后重试。`;
          }
        } else {
          detailedErrorMessage = `网络请求失败: ${errorMessage}。错误类型: ${errorName}。请检查网络连接或稍后重试。`;
        }
      }
      
      console.error('═══════════════════════════════════════════════════════════');
      console.error(`❌ 任务执行失败: ${taskRecord.id}`);
      console.error('═══════════════════════════════════════════════════════════');
      console.error('错误类型:', errorName);
      console.error('原始错误信息:', errorMessage);
      console.error('详细错误信息:', detailedErrorMessage);
      console.error('错误信息长度:', detailedErrorMessage.length);
      if (errorStack) {
        console.error('错误堆栈（前2000字符）:', errorStack.substring(0, 2000));
      }
      console.error('═══════════════════════════════════════════════════════════');
      
      // 检查是否是数据库连接错误
      if (errorMessage.includes('database') || errorMessage.includes('connection')) {
        console.log(`任务 ${taskRecord.id} 遇到数据库连接问题，等待重试`);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return; // 不标记为失败，等待重试
      }
      
      // 检查是否是临时性网络错误（fetch failed、网络请求失败等）
      // 对于这类错误，如果重试次数未超限，不立即标记为失败，而是等待重试
      // 注意：音频下载失败不应该被视为临时性网络错误，因为音频下载失败通常是永久性的（如URL无效、文件不存在等）
      const isTemporaryNetworkError = (errorMessage.includes('fetch failed') || 
                                       errorMessage.includes('网络请求失败') ||
                                       errorMessage.includes('ECONNREFUSED') ||
                                       errorMessage.includes('ETIMEDOUT') ||
                                       errorMessage.includes('ENOTFOUND') ||
                                       errorMessage.includes('DNS') ||
                                       errorMessage.includes('HTTP_429') ||
                                       errorMessage.includes('HTTP_403') ||
                                       errorMessage.includes('请求过于频繁') ||
                                       errorMessage.includes('访问被禁止')) &&
                                       !errorMessage.includes('音频下载失败'); // 排除音频下载失败
      
      if (isTemporaryNetworkError) {
        const retryCount = this.retryAttempts.get(taskRecord.id) || 0;
        console.log(`[强制日志] 检测到临时性网络错误: ${taskRecord.id}, 当前重试次数: ${retryCount}, 最大重试次数: ${this.maxRetries}`);
        if (retryCount < this.maxRetries) {
          console.log(`[强制日志] 任务 ${taskRecord.id} 遇到临时性网络错误，等待重试 (${retryCount + 1}/${this.maxRetries})`);
          // 指数退避：第1次重试等待5秒，第2次等待10秒，第3次等待20秒
          const delay = Math.min(5000 * Math.pow(2, retryCount), 20000);
          console.log(`[强制日志] 等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          // 从运行中任务集合移除，允许任务队列重新处理
          this.runningTasks.delete(taskRecord.id);
          // 将任务状态重置为PENDING，以便重新处理
          await dbRetry.taskQueue.update({
            where: { id: taskRecord.id },
            data: {
              status: 'PENDING',
              error: null,
              startedAt: null,
              completedAt: null,
              updatedAt: new Date()
            }
          });
          console.log(`[强制日志] 任务 ${taskRecord.id} 已重置为PENDING状态，等待重新处理`);
          return; // 不标记为失败，等待重试
        } else {
          console.log(`[强制日志] 任务 ${taskRecord.id} 重试次数已达上限 (${retryCount}/${this.maxRetries})，标记为失败`);
        }
      }
      
      // 更新任务状态为失败，确保错误信息完整（限制长度避免数据库字段超限）
      // 使用详细错误信息而不是原始错误信息
      let errorToSave = detailedErrorMessage;
      if (errorToSave.length > 500) {
        // 如果错误信息过长，截断但保留关键信息
        errorToSave = errorToSave.substring(0, 497) + '...';
      }
      
      console.log(`保存错误信息到数据库（长度: ${errorToSave.length}）: ${errorToSave.substring(0, 100)}...`);
      await this.markTaskFailed(taskRecord.id, errorToSave);
    }
  }

  // 检查任务超时和已完成但状态未更新的任务
  private async checkTaskTimeouts() {
    try {
      const now = Date.now();
      const timeoutTasks: string[] = [];

      // 1. 检查内存中的任务超时
      for (const [taskId, startTime] of this.taskStartTimes.entries()) {
        const runningTime = now - startTime;
        if (runningTime > this.maxTaskDuration) {
          timeoutTasks.push(taskId);
        }
      }

      // 2. 从数据库查询长时间运行的任务（防止应用重启后丢失内存状态）
      const longRunningTasks = await dbRetry.taskQueue.findMany({
        where: {
          status: 'RUNNING',
          startedAt: {
            not: null,
            lt: new Date(now - this.maxTaskDuration)
          }
        },
        select: {
          id: true,
          data: true,
          startedAt: true
        }
      }) as Array<{ id: string; data: any; startedAt: Date | null }>;

      for (const task of longRunningTasks) {
        if (!timeoutTasks.includes(task.id)) {
          timeoutTasks.push(task.id);
        }
        // 从内存中移除（如果存在）
        this.runningTasks.delete(task.id);
        this.taskStartTimes.delete(task.id);
      }

      // 3. 处理超时任务
      for (const taskId of timeoutTasks) {
        console.log(`⏱️ 任务 ${taskId} 运行时间超过 ${this.maxTaskDuration / 1000 / 60} 分钟，强制终止`);
        await this.markTaskFailed(taskId, `任务运行时间超过 ${this.maxTaskDuration / 1000 / 60} 分钟，自动终止`);
      }

      // 4. 检查已完成但状态未更新的任务（通过检查数据库中是否存在对应的播客）
      await this.checkCompletedTasks();
    } catch (error) {
      console.error('检查任务超时时出错:', error);
    }
  }

  // 检查已完成但状态未更新的任务
  private async checkCompletedTasks() {
    try {
      // 查找所有 RUNNING 状态且已运行超过5分钟的任务
      const runningTasks = await dbRetry.taskQueue.findMany({
        where: {
          status: 'RUNNING',
          startedAt: {
            not: null,
            lt: new Date(Date.now() - 5 * 60 * 1000) // 运行超过5分钟
          }
        },
        select: {
          id: true,
          data: true,
          startedAt: true
        },
        take: 20 // 限制查询数量，避免性能问题
      }) as Array<{ id: string; data: any; startedAt: Date | null }>;

      if (runningTasks.length === 0) {
        return;
      }

      console.log(`🔍 检查 ${runningTasks.length} 个运行中的任务是否已完成...`);

      for (const task of runningTasks) {
        const taskData = task.data as any;
        const url = taskData?.url;
        
        if (!url) {
          continue;
        }

        try {
          // 标准化URL，确保能匹配数据库中存储的标准化URL
          const normalizedUrl = normalizePodcastUrl(url);
          
          // 检查数据库中是否存在对应的播客（通过 sourceUrl 或 audioUrl 匹配）
          // 同时搜索原始URL和标准化URL，以兼容新旧数据
          const podcastResult = await dbRetry.podcast.findFirst({
            where: {
              OR: [
                { sourceUrl: url },           // 原始URL
                { sourceUrl: normalizedUrl }, // 标准化URL
                { audioUrl: url },            // 原始URL（audioUrl）
                { audioUrl: normalizedUrl }   // 标准化URL（audioUrl）
              ],
              status: 'READY' as any // 只检查已完成处理的播客
            },
            select: {
              id: true,
              title: true,
              status: true
            }
          });
          
          const podcast = podcastResult as { id: string; title: string | null; status: string } | null;

          if (podcast) {
            // 播客已存在且状态为 READY，说明任务实际上已完成
            console.log(`✅ 发现已完成但状态未更新的任务: ${task.id}, 播客ID: ${podcast.id}`);
            
            // 更新任务状态为 READY
            await this.updateTaskStatusWithRetry(task.id, {
              status: 'READY',
              result: {
                id: podcast.id,
                title: podcast.title,
                status: podcast.status
              },
              completedAt: new Date(),
              updatedAt: new Date()
            });

            // 从内存中移除
            this.runningTasks.delete(task.id);
            this.taskStartTimes.delete(task.id);
            
            console.log(`✅ 任务 ${task.id} 状态已更新为 READY`);
          }
        } catch (error) {
          console.error(`检查任务 ${task.id} 时出错:`, error);
        }
      }
    } catch (error) {
      console.error('检查已完成任务时出错:', error);
    }
  }

  // 标记任务失败
  private async markTaskFailed(taskId: string, error: string) {
    try {
      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`🔴 标记任务失败: ${taskId}`);
      console.log(`   错误信息: ${error}`);
      console.log(`   错误信息长度: ${error.length}`);
      console.log(`   调用堆栈:`, new Error().stack?.split('\n').slice(1, 5).join('\n'));
      console.log(`═══════════════════════════════════════════════════════════`);
      
      await dbRetry.taskQueue.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          error,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log(`✅ 任务 ${taskId} 已标记为失败: ${error}`);
    } catch (updateError) {
      console.error('❌ 标记任务失败时出错:', updateError);
    }
  }

  // 处理播客任务
  private async processPodcastTask(taskRecord: any) {
    const { url, userId } = taskRecord.data;
    
    try {
      console.log(`[processPodcastTask] 开始处理任务: ${taskRecord.id}, URL: ${url}, userId: ${userId || 'null'}`);
      
      // 这里调用现有的处理逻辑
      // 可以复用现有的 process-audio 逻辑，但改为内部函数调用
      const result = await this.processPodcastInternal(url, userId, taskRecord.id);
      
      console.log(`[processPodcastTask] processPodcastInternal 返回结果:`, result ? JSON.stringify(result).substring(0, 200) : 'null');
      
      // 检查结果是否为空
      if (!result) {
        console.error(`[processPodcastTask] ❌ processPodcastInternal 返回 null 或 undefined: ${taskRecord.id}`);
        await this.updateTaskStatusWithRetry(taskRecord.id, {
          status: 'FAILED',
          result: null,
          error: 'processAudioInternal 返回了空结果，可能是处理过程中出现了未捕获的异常',
          completedAt: new Date(),
          updatedAt: new Date()
        });
        return;
      }
      
      // 检查是否是部分成功（ASR成功但报告失败）
      const isPartialSuccess = (result as any)?.partialSuccess === true;
      const hasError = (result as any)?.error;
      
      console.log(`[processPodcastTask] 处理结果分析: isPartialSuccess=${isPartialSuccess}, success=${(result as any)?.success}, hasError=${!!hasError}`);
      
      // 如果报告生成失败，任务应该标记为 FAILED，但保留结果（ASR数据）
      if (isPartialSuccess || (result as any)?.success === false) {
        console.log(`[processPodcastTask] 标记为部分成功（ASR成功但报告失败）: ${taskRecord.id}`);
        // 使用重试机制更新状态，如果失败则记录错误但不抛出异常
        try {
          await this.updateTaskStatusWithRetry(taskRecord.id, {
            status: 'FAILED',
            result: result,
            error: hasError || '报告生成失败或超时，但ASR转写已成功完成',
            completedAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`播客处理部分成功（ASR成功但报告失败）: ${taskRecord.id}`);
        } catch (updateError) {
          console.error(`[processPodcastTask] ⚠️ 任务状态更新失败（部分成功）: ${taskRecord.id}`, updateError);
          // 尝试直接更新
          try {
            await dbRetry.taskQueue.update({
              where: { id: taskRecord.id },
              data: {
                status: 'FAILED',
                result: result,
                error: hasError || '报告生成失败或超时，但ASR转写已成功完成',
                completedAt: new Date(),
                updatedAt: new Date()
              }
            });
            console.log(`✅ 任务状态已通过直接更新恢复（部分成功）: ${taskRecord.id}`);
          } catch (directUpdateError) {
            console.error(`[processPodcastTask] ❌ 直接更新也失败（部分成功）: ${taskRecord.id}`, directUpdateError);
            // 即使更新失败，也不抛出异常，让 checkCompletedTasks 后续检查并修复状态
          }
        }
      } else {
        console.log(`[processPodcastTask] 标记为完全成功: ${taskRecord.id}`);
        // 完全成功，标记为 READY
        // 使用重试机制更新状态，如果失败则记录错误但不抛出异常
        try {
          await this.updateTaskStatusWithRetry(taskRecord.id, {
            status: 'READY',
            result: result,
            error: null, // 清除之前的错误信息
            completedAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✅ 播客处理任务完成: ${taskRecord.id}`);
        } catch (updateError) {
          // 状态更新失败，但任务实际已成功，记录警告并尝试直接更新
          console.error(`[processPodcastTask] ⚠️ 任务状态更新失败，但任务已成功完成: ${taskRecord.id}`, updateError);
          try {
            // 最后一次尝试直接更新，不使用重试机制
            await dbRetry.taskQueue.update({
              where: { id: taskRecord.id },
              data: {
                status: 'READY',
                result: result,
                error: null,
                completedAt: new Date(),
                updatedAt: new Date()
              }
            });
            console.log(`✅ 任务状态已通过直接更新恢复: ${taskRecord.id}`);
          } catch (directUpdateError) {
            console.error(`[processPodcastTask] ❌ 直接更新也失败: ${taskRecord.id}`, directUpdateError);
            // 即使更新失败，也不抛出异常，因为任务实际已成功
            // 让 checkCompletedTasks 后续检查并修复状态
          }
        }

        // 如果是 MuleRun 查询，更新查询状态并报告成本
        const mulerunQueryId = taskRecord.data?.mulerunQueryId;
        const mulerunSessionId = taskRecord.data?.mulerunSessionId;
        if (mulerunQueryId && mulerunSessionId && (result as any)?.id) {
          await this.handleMulerunQuerySuccess(
            mulerunSessionId,
            mulerunQueryId,
            (result as any).id
          );
        }
      }
      
      // 清除重试记录
      this.retryAttempts.delete(taskRecord.id);
      
    } catch (error) {
      console.error(`[processPodcastTask] ❌ 捕获到异常: ${taskRecord.id}`, error);
      
      // 如果是 MuleRun 查询，更新查询状态为失败
      const mulerunQueryId = taskRecord.data?.mulerunQueryId;
      const mulerunSessionId = taskRecord.data?.mulerunSessionId;
      if (mulerunQueryId && mulerunSessionId) {
        await this.handleMulerunQueryFailure(
          mulerunSessionId,
          mulerunQueryId,
          error instanceof Error ? error.message : String(error)
        );
      }
      
      throw error; // 让上层处理错误
    }
  }

  // 处理 MuleRun 查询成功
  private async handleMulerunQuerySuccess(
    mulerunSessionId: string,
    mulerunQueryId: string,
    podcastId: string
  ) {
    try {
      const { updateQuery } = await import('./mulerun/session-manager');
      const { reportMetering } = await import('./mulerun/metering');
      const { db } = await import('./db');

      // 获取会话信息
      const session = await db.mulerunSession.findUnique({
        where: { id: mulerunSessionId },
      });

      if (!session) {
        console.error(`[MuleRun] 会话不存在: ${mulerunSessionId}`);
        return;
      }

      // 更新查询状态
      const meteringId = `podcast-${mulerunQueryId}-${Date.now()}`;
      const costCredits = parseFloat(process.env.MULERUN_QUERY_COST_CREDITS || '100');

      await updateQuery(mulerunQueryId, {
        status: 'completed',
        podcastId,
        meteringId,
        costCredits,
        completedAt: new Date(),
      });

      // 报告成本到 Metering API
      const reported = await reportMetering(
        session.sessionId,
        meteringId,
        costCredits,
        `Podcast processing completed: ${podcastId}`
      );

      if (!reported) {
        console.error(`[MuleRun] Metering 报告失败: sessionId=${session.sessionId}, queryId=${mulerunQueryId}`);
      } else {
        console.log(`[MuleRun] 查询成功并报告成本: sessionId=${session.sessionId}, queryId=${mulerunQueryId}, credits=${costCredits}`);
      }
    } catch (error) {
      console.error(`[MuleRun] 处理查询成功失败:`, error);
    }
  }

  // 处理 MuleRun 查询失败
  private async handleMulerunQueryFailure(
    mulerunSessionId: string,
    mulerunQueryId: string,
    errorMessage: string
  ) {
    try {
      const { updateQuery } = await import('./mulerun/session-manager');
      const { reportMetering } = await import('./mulerun/metering');
      const { db } = await import('./db');

      // 获取会话信息
      const session = await db.mulerunSession.findUnique({
        where: { id: mulerunSessionId },
      });

      if (!session) {
        console.error(`[MuleRun] 会话不存在: ${mulerunSessionId}`);
        return;
      }

      // 更新查询状态为失败
      await updateQuery(mulerunQueryId, {
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
      });

      // 发送 final Metering 报告（0 credits，表示失败）
      const meteringId = `failed-${mulerunQueryId}-${Date.now()}`;
      await reportMetering(
        session.sessionId,
        meteringId,
        0,
        `Podcast processing failed: ${errorMessage}`,
        true // isFinal
      );

      // 更新 meteringId
      await updateQuery(mulerunQueryId, {
        meteringId,
        costCredits: 0,
      });

      console.log(`[MuleRun] 查询失败并报告: sessionId=${session.sessionId}, queryId=${mulerunQueryId}`);
    } catch (error) {
      console.error(`[MuleRun] 处理查询失败失败:`, error);
    }
  }

  // 带重试机制的任务状态更新
  private async updateTaskStatusWithRetry(taskId: string, data: any, maxRetries: number = 3): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await dbRetry.taskQueue.update({
          where: { id: taskId },
          data: data
        });
        console.log(`✅ 任务状态更新成功: ${taskId} (尝试 ${attempt}/${maxRetries})`);
        return; // 成功，退出重试循环
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ 任务状态更新失败 (尝试 ${attempt}/${maxRetries}): ${taskId}`, lastError.message);
        
        if (attempt < maxRetries) {
          // 指数退避：第1次重试等待1秒，第2次等待2秒
          const delay = 1000 * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 所有重试都失败，抛出最后一个错误
    console.error(`❌ 任务状态更新失败，已重试 ${maxRetries} 次: ${taskId}`, lastError);
    throw lastError;
  }

  // 内部播客处理逻辑（复用现有代码）
  private async processPodcastInternal(url: string, userId?: string, taskId?: string) {
    console.log(`[强制日志] processPodcastInternal 开始: ${url}, taskId: ${taskId || '无'}`);
    try {
      console.log(`📝 开始内部处理播客: ${url}, taskId: ${taskId || '无'}`);
      // 直接调用现有的处理逻辑，而不是通过HTTP请求
      // 使用静态导入，避免 Turbopack 模块加载问题
      
      // 调用内部处理函数
      console.log(`[强制日志] 准备调用 processAudioInternal: ${url}, userId: ${userId || 'null'}`);
      const result = await processAudioInternal(url, userId, taskId);
      console.log(`[强制日志] processAudioInternal 返回结果:`, result ? '成功' : '失败');
      
      if (result) {
        console.log(`✅ 内部处理播客成功: ${url}`);
        console.log(`   播客ID: ${(result as any)?.id || 'N/A'}`);
        console.log(`   处理耗时: ${(result as any)?.processingTime || 'N/A'}ms`);
        console.log(`   是否部分成功: ${(result as any)?.partialSuccess || false}`);
      } else {
        console.warn(`⚠️ processAudioInternal 返回空结果: ${url}`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      console.error('═══════════════════════════════════════════════════════════');
      console.error(`[强制日志] processPodcastInternal 捕获错误: ${url}`);
      console.error('═══════════════════════════════════════════════════════════');
      console.error('错误类型:', errorName);
      console.error('错误消息:', errorMessage);
      if (errorStack) {
        console.error('错误堆栈（前2000字符）:', errorStack.substring(0, 2000));
      }
      console.error('任务ID:', taskId || 'N/A');
      console.error('用户ID:', userId || 'N/A');
      console.error('═══════════════════════════════════════════════════════════');
      
      // 清理错误信息，移除可能的残留变量引用
      let cleanedErrorMessage = errorMessage;
      if (errorMessage.includes('is not defined') || errorMessage.includes('未定义')) {
        // 如果是未定义变量错误，尝试提取更具体的错误信息
        if (errorStack) {
          const stackLines = errorStack.split('\n');
          // 查找第一个包含实际错误信息的行（不是变量名）
          const relevantLine = stackLines.find(line => 
            (line.includes('Error') || line.includes('TypeError') || line.includes('ReferenceError')) &&
            !line.includes('is not defined')
          );
          if (relevantLine) {
            cleanedErrorMessage = `处理失败: ${relevantLine.trim()}`;
          } else {
            cleanedErrorMessage = '处理失败: 代码执行错误，可能是配置问题或代码版本不匹配';
          }
        } else {
          cleanedErrorMessage = '处理失败: 代码执行错误，可能是配置问题或代码版本不匹配';
        }
      }
      
      // 重新抛出清理后的错误
      throw new Error(cleanedErrorMessage);
    }
  }
}

// 导出单例
export const taskQueue = new TaskQueue();

// 在应用启动时启动任务处理器
if (typeof window === 'undefined') {
  // 只在服务器端启动，延迟初始化
  // 在构建时（next build）不启动任务队列，避免日志过多
  // Next.js 在构建时会设置 NEXT_PHASE 环境变量
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
  
  if (!isBuildTime) {
    setTimeout(async () => {
      await taskQueue.initialize();
      taskQueue.startProcessing();
    }, 2000); // 延迟2秒启动，确保数据库连接就绪
  } else {
    // 构建时只初始化，不启动轮询
    console.log('构建阶段：跳过任务队列启动');
  }
}
