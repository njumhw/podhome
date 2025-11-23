// 颜色生成工具函数 - 基于标题生成一致的强调色

export const ACCENT_COLORS = [
  { 
    text: "text-blue-400", 
    bg: "bg-blue-500/20", 
    border: "border-blue-500/50", 
    shadow: "shadow-blue-500/20",
    glow: "shadow-blue-500/30"
  },
  { 
    text: "text-purple-400", 
    bg: "bg-purple-500/20", 
    border: "border-purple-500/50", 
    shadow: "shadow-purple-500/20",
    glow: "shadow-purple-500/30"
  },
  { 
    text: "text-emerald-400", 
    bg: "bg-emerald-500/20", 
    border: "border-emerald-500/50", 
    shadow: "shadow-emerald-500/20",
    glow: "shadow-emerald-500/30"
  },
  { 
    text: "text-cyan-400", 
    bg: "bg-cyan-500/20", 
    border: "border-cyan-500/50", 
    shadow: "shadow-cyan-500/20",
    glow: "shadow-cyan-500/30"
  },
  { 
    text: "text-pink-400", 
    bg: "bg-pink-500/20", 
    border: "border-pink-500/50", 
    shadow: "shadow-pink-500/20",
    glow: "shadow-pink-500/30"
  },
  { 
    text: "text-orange-400", 
    bg: "bg-orange-500/20", 
    border: "border-orange-500/50", 
    shadow: "shadow-orange-500/20",
    glow: "shadow-orange-500/30"
  },
  { 
    text: "text-indigo-400", 
    bg: "bg-indigo-500/20", 
    border: "border-indigo-500/50", 
    shadow: "shadow-indigo-500/20",
    glow: "shadow-indigo-500/30"
  },
  { 
    text: "text-violet-400", 
    bg: "bg-violet-500/20", 
    border: "border-violet-500/50", 
    shadow: "shadow-violet-500/20",
    glow: "shadow-violet-500/30"
  },
];

/**
 * 基于标题字符串生成一致的强调色样式
 * @param title 播客标题
 * @returns 包含 text, bg, border, shadow, glow 的样式对象
 */
export function getStyleFromTitle(title: string) {
  // 简单的哈希函数
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

/**
 * 生成渐变背景样式（用于替代封面图）
 * @param title 播客标题
 * @returns 渐变背景的 className
 */
export function getGradientFromTitle(title: string) {
  const style = getStyleFromTitle(title);
  const colorMap: Record<string, string> = {
    'text-blue-400': 'from-blue-500/30 via-blue-600/20 to-blue-700/10',
    'text-purple-400': 'from-purple-500/30 via-purple-600/20 to-purple-700/10',
    'text-emerald-400': 'from-emerald-500/30 via-emerald-600/20 to-emerald-700/10',
    'text-cyan-400': 'from-cyan-500/30 via-cyan-600/20 to-cyan-700/10',
    'text-pink-400': 'from-pink-500/30 via-pink-600/20 to-pink-700/10',
    'text-orange-400': 'from-orange-500/30 via-orange-600/20 to-orange-700/10',
    'text-indigo-400': 'from-indigo-500/30 via-indigo-600/20 to-indigo-700/10',
    'text-violet-400': 'from-violet-500/30 via-violet-600/20 to-violet-700/10',
  };
  return `bg-gradient-to-br ${colorMap[style.text] || 'from-blue-500/30 via-blue-600/20 to-blue-700/10'}`;
}

