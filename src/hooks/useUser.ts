import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
}

interface DailyUsage {
  used: number;
  limit: number;
}

// 全局用户状态管理
let globalUser: User | null = null;
let globalDailyUsage: DailyUsage = { used: 0, limit: 0 };
let userListeners: Set<() => void> = new Set();

const notifyListeners = () => {
  userListeners.forEach(listener => listener());
};

export function useUser() {
  const [user, setUser] = useState<User | null>(globalUser);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>(globalDailyUsage);
  const [isLoading, setIsLoading] = useState(true);

  const updateUser = useCallback((newUser: User | null) => {
    globalUser = newUser;
    setUser(newUser);
    notifyListeners();
  }, []);

  const updateDailyUsage = useCallback((newUsage: DailyUsage) => {
    globalDailyUsage = newUsage;
    setDailyUsage(newUsage);
    notifyListeners();
  }, []);

  const checkUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      
      if (data.user) {
        updateUser(data.user);
        
        // 获取用户使用量
        try {
          const usageRes = await fetch("/api/user/daily-usage");
          const usageData = await usageRes.json();
          if (usageData.success) {
            updateDailyUsage({ used: usageData.used, limit: usageData.limit });
          }
        } catch (error) {
          console.error('Failed to fetch daily usage:', error);
        }
      } else {
        updateUser(null);
        updateDailyUsage({ used: 0, limit: 0 });
      }
    } catch (error) {
      updateUser(null);
      updateDailyUsage({ used: 0, limit: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [updateUser, updateDailyUsage]);

  useEffect(() => {
    // 如果已经有用户数据，直接使用
    if (globalUser) {
      setUser(globalUser);
      setDailyUsage(globalDailyUsage);
      setIsLoading(false);
    } else {
      // 否则检查用户状态
      checkUser();
    }

    // 监听全局状态变化
    const listener = () => {
      setUser(globalUser);
      setDailyUsage(globalDailyUsage);
    };
    
    userListeners.add(listener);
    
    return () => {
      userListeners.delete(listener);
    };
  }, [checkUser]);

  return {
    user,
    dailyUsage,
    isLoading,
    checkUser,
    updateUser,
    updateDailyUsage
  };
}

