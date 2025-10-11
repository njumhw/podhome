"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AudioConfigPanel } from "@/components/AudioConfigPanel";
import { PromptManager } from "@/components/PromptManager";

type Invite = { 
	id: string;
	code: string; 
	maxUses: number; 
	uses: number;
	expiresAt?: string | null;
	createdAt: string;
	usedBy?: {
		id: string;
		username: string;
		email: string;
		role: string;
		createdAt: string;
	};
};

type Topic = { 
	id: string; 
	name: string; 
	description?: string; 
	color?: string; 
	approved: boolean;
	_count?: { podcasts: number };
};

type User = { 
	id: string; 
	email: string; 
	username: string; 
	role: string; 
	isBanned: boolean;
	lastLoginAt: string | null;
	uploadCount: number;
	createdAt: string; 
};

export default function AdminPage() {
	const [active, setActive] = useState<"invites" | "topics" | "users" | "tasks" | "cost" | "audio" | "prompts">("invites");

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">管理后台</h2>
				<Link
					href="/home"
					className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
				>
					<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
					返回首页
				</Link>
			</div>
			<div className="inline-flex rounded-xl border border-black/10 dark:border-white/10 p-1 bg-white/60 dark:bg-black/40 backdrop-blur">
				{(["invites","topics","users","tasks","cost","audio","prompts"] as const).map(k => (
					<button key={k} onClick={() => setActive(k)} className={`px-3 py-1.5 text-sm rounded-lg ${active===k?"bg-black text-white dark:bg-white dark:text-black":"text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10"}`}>{label(k)}</button>
				))}
			</div>

			{active === "invites" && <InvitesPanel />}
			{active === "topics" && <TopicsPanel />}
			{active === "users" && <UsersPanel />}
			{active === "tasks" && <TasksPanel />}
			{active === "cost" && <CostPanel />}
			{active === "audio" && <AudioConfigPanel />}
			{active === "prompts" && <PromptManager />}
		</div>
	);
}

function label(k: string) {
	return (
		{
			invites: "邀请码",
			topics: "主题审核",
			users: "用户管理",
			tasks: "任务日志",
			cost: "成本监控",
			audio: "音频配置",
			prompts: "提示词管理",
		} as Record<string, string>
	)[k];
}

function InvitesPanel() {
	const [count, setCount] = useState(1);
	const [maxUses, setMaxUses] = useState(1);
	const [expiresAt, setExpiresAt] = useState("");
	const [items, setItems] = useState<Invite[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	
	async function loadCodes() {
		setError(null);
		try {
			const res = await fetch("/api/admin/invite-codes");
			if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
			const data = await res.json();
			setItems(data.codes ?? []);
		} catch (e: any) { setError(e.message || "加载失败"); }
	}
	
	async function create() {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/admin/invite/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ count, maxUses, expiresAt: expiresAt || undefined }) });
			if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
			await loadCodes(); // 重新加载邀请码列表
		} catch (e: any) { setError(e.message || "请求失败"); }
		finally { setLoading(false); }
	}
	
	useEffect(() => { loadCodes(); }, []);
	return (
		<div className="space-y-3">
			<div className="flex gap-2 items-center text-sm">
				<input type="number" min={1} max={100} value={count} onChange={(e)=>setCount(+e.target.value)} className="w-24 rounded-lg border border-black/10 px-2 py-1 bg-white/60 dark:bg-black/40" />
				<input type="number" min={1} max={100} value={maxUses} onChange={(e)=>setMaxUses(+e.target.value)} className="w-24 rounded-lg border border-black/10 px-2 py-1 bg-white/60 dark:bg-black/40" />
				<input type="datetime-local" value={expiresAt} onChange={(e)=>setExpiresAt(e.target.value)} className="rounded-lg border border-black/10 px-2 py-1 bg-white/60 dark:bg-black/40" />
				<button onClick={create} disabled={loading} className="px-3 py-2 text-sm rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50">生成</button>
			</div>
			{error && <div className="text-xs text-red-600">{error}</div>}
			{items.length>0 && (
				<div className="text-sm space-y-2">
					<div className="font-medium text-gray-600 dark:text-gray-400">邀请码列表</div>
					{items.map((it,i)=>(
						<div key={it.id} className="border border-black/10 dark:border-white/10 rounded-lg p-3 space-y-2">
							<div className="flex justify-between items-center">
								<span className="font-mono font-medium">{it.code}</span>
								<span className="text-xs text-gray-500">
									{it.uses}/{it.maxUses} 次使用
									{it.expiresAt ? ` · ${new Date(it.expiresAt).toLocaleString()}` : " · 永不过期"}
								</span>
							</div>
							{it.usedBy && (
								<div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
									<div>使用者: {it.usedBy.username} ({it.usedBy.email})</div>
									<div>角色: {it.usedBy.role} · 注册时间: {new Date(it.usedBy.createdAt).toLocaleString()}</div>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function TopicsPanel() {
	const [topics, setTopics] = useState<Topic[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
	const [newTopic, setNewTopic] = useState({
		name: '',
		description: '',
		color: '#3B82F6'
	});

	async function load() {
		setError(null);
		setLoading(true);
		try {
			const res = await fetch("/api/admin/topics");
			if (!res.ok) { 
				setError(await res.text()); 
				setTopics([]); 
				return; 
			}
			const data = await res.json();
			setTopics(data.topics ?? []);
		} catch (err) {
			setError('加载失败');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	async function approve(id: string) {
		try {
			const res = await fetch("/api/admin/topics", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id, approved: true })
			});
			if (!res.ok) { setError(await res.text()); return; }
			load();
		} catch (err) {
			setError('操作失败');
		}
	}

	async function deleteTopic(id: string) {
		if (!confirm('确定要删除这个主题吗？')) return;
		try {
			const res = await fetch(`/api/admin/topics?id=${id}`, { method: "DELETE" });
			if (!res.ok) { setError(await res.text()); return; }
			load();
		} catch (err) {
			setError('删除失败');
		}
	}

	async function createTopic() {
		if (!newTopic.name.trim()) {
			setError('请输入主题名称');
			return;
		}
		try {
			const res = await fetch("/api/admin/topics", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(newTopic)
			});
			if (!res.ok) { setError(await res.text()); return; }
			setNewTopic({ name: '', description: '', color: '#3B82F6' });
			setShowCreateForm(false);
			load();
		} catch (err) {
			setError('创建失败');
		}
	}

	async function updateTopic() {
		if (!editingTopic || !editingTopic.name.trim()) {
			setError('请输入主题名称');
			return;
		}
		try {
			const res = await fetch("/api/admin/topics", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(editingTopic)
			});
			if (!res.ok) { setError(await res.text()); return; }
			setEditingTopic(null);
			load();
		} catch (err) {
			setError('更新失败');
		}
	}

	const pendingTopics = topics.filter(t => !t.approved);
	const approvedTopics = topics.filter(t => t.approved);

	return (
		<div className="space-y-6">
			{error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}
			
			{/* 创建新主题 */}
			<div className="bg-white border border-gray-200 rounded-lg p-4">
				<div className="flex items-center justify-between mb-4">
					<h3 className="font-medium">主题管理</h3>
					<button
						onClick={() => setShowCreateForm(!showCreateForm)}
						className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
					>
						{showCreateForm ? '取消' : '新建主题'}
					</button>
				</div>

				{showCreateForm && (
					<div className="space-y-3 p-4 bg-gray-50 rounded">
						<div>
							<label className="block text-sm font-medium mb-1">主题名称 *</label>
							<input
								type="text"
								value={newTopic.name}
								onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
								className="w-full p-2 border border-gray-300 rounded text-sm"
								placeholder="请输入主题名称"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">主题描述</label>
							<textarea
								value={newTopic.description}
								onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
								className="w-full p-2 border border-gray-300 rounded text-sm"
								rows={2}
								placeholder="请输入主题描述（可选）"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">主题颜色</label>
							<div className="flex items-center gap-2">
								<input
									type="color"
									value={newTopic.color}
									onChange={(e) => setNewTopic({ ...newTopic, color: e.target.value })}
									className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
								/>
								<span className="text-sm text-gray-600">选择主题标识颜色</span>
							</div>
						</div>
						<button
							onClick={createTopic}
							className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
						>
							创建主题
						</button>
					</div>
				)}
			</div>

			{/* 待审核主题 */}
			{pendingTopics.length > 0 && (
				<div className="bg-white border border-gray-200 rounded-lg p-4">
					<h3 className="font-medium mb-3">待审核主题 ({pendingTopics.length})</h3>
					<div className="space-y-2">
						{pendingTopics.map(topic => (
							<div key={topic.id} className="flex items-center justify-between border-b border-gray-100 py-2">
								<div className="flex items-center gap-3">
									<div 
										className="w-4 h-4 rounded-full"
										style={{ backgroundColor: topic.color }}
									/>
									<div>
										<div className="font-medium">{topic.name}</div>
										{topic.description && (
											<div className="text-sm text-gray-600">{topic.description}</div>
										)}
									</div>
								</div>
								<div className="flex gap-2">
									<button 
										onClick={() => approve(topic.id)}
										className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
									>
										通过
									</button>
									<button 
										onClick={() => deleteTopic(topic.id)}
										className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
									>
										删除
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* 已审核主题 */}
			<div className="bg-white border border-gray-200 rounded-lg p-4">
				<h3 className="font-medium mb-3">已审核主题 ({approvedTopics.length})</h3>
				{loading ? (
					<div className="text-gray-500">加载中...</div>
				) : approvedTopics.length === 0 ? (
					<div className="text-gray-500">暂无已审核主题</div>
				) : (
					<div className="space-y-2">
						{approvedTopics.map(topic => (
							<div key={topic.id} className="flex items-center justify-between border-b border-gray-100 py-2">
								<div className="flex items-center gap-3">
									<div 
										className="w-4 h-4 rounded-full"
										style={{ backgroundColor: topic.color }}
									/>
									<div>
										<div className="font-medium">{topic.name}</div>
										{topic.description && (
											<div className="text-sm text-gray-600">{topic.description}</div>
										)}
										<div className="text-xs text-gray-500">
											{topic._count?.podcasts || 0} 个播客
										</div>
									</div>
								</div>
								<div className="flex gap-2">
									<button 
										onClick={() => setEditingTopic(topic)}
										className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
									>
										编辑
									</button>
									<button 
										onClick={() => deleteTopic(topic.id)}
										className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
									>
										删除
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* 编辑主题模态框 */}
			{editingTopic && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
						<h3 className="font-medium mb-4">编辑主题</h3>
						<div className="space-y-3">
							<div>
								<label className="block text-sm font-medium mb-1">主题名称 *</label>
								<input
									type="text"
									value={editingTopic.name}
									onChange={(e) => setEditingTopic({ ...editingTopic, name: e.target.value })}
									className="w-full p-2 border border-gray-300 rounded text-sm"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-1">主题描述</label>
								<textarea
									value={editingTopic.description || ''}
									onChange={(e) => setEditingTopic({ ...editingTopic, description: e.target.value })}
									className="w-full p-2 border border-gray-300 rounded text-sm"
									rows={2}
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-1">主题颜色</label>
								<input
									type="color"
									value={editingTopic.color || '#3B82F6'}
									onChange={(e) => setEditingTopic({ ...editingTopic, color: e.target.value })}
									className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
								/>
							</div>
							<div className="flex gap-2">
								<button
									onClick={updateTopic}
									className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
								>
									保存
								</button>
								<button
									onClick={() => setEditingTopic(null)}
									className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
								>
									取消
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function UsersPanel() {
	const [items, setItems] = useState<User[]>([]);
	const [error, setError] = useState<string | null>(null);
	async function load() {
		setError(null);
		const res = await fetch(`/api/admin/users`);
		if (!res.ok) { setError(await res.text()); setItems([]); return; }
		const data = await res.json();
		setItems(data.items ?? []);
	}
	useEffect(()=>{load();},[]);
	async function act(userId: string, action: "promote"|"demote"|"ban"|"unban") {
		const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, action }) });
		if (!res.ok) { setError(await res.text()); return; }
		load();
	}
	
	function getRoleBadge(role: string) {
		const colors = role === "ADMIN" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
		return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors}`}>{role === "ADMIN" ? "管理员" : "普通用户"}</span>;
	}
	
	function getStatusBadge(isBanned: boolean) {
		if (isBanned) {
			return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">已封禁</span>;
		}
		return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">正常</span>;
	}
	
	return (
		<div className="space-y-4">
			{error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</div>}
			
			<div className="text-sm text-gray-600 dark:text-gray-400">
				共 {items.length} 个用户
			</div>
			
			<div className="space-y-3">
				{items.map(u => (
					<div key={u.id} className="border border-black/10 dark:border-white/10 rounded-lg p-4 space-y-3">
						{/* 用户基本信息 */}
						<div className="flex items-start justify-between">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<span className="font-medium text-base">{u.username}</span>
									{getRoleBadge(u.role)}
									{getStatusBadge(u.isBanned)}
								</div>
								<div className="text-sm text-gray-600 dark:text-gray-400">{u.email}</div>
								<div className="text-xs text-gray-500">
									注册时间: {new Date(u.createdAt).toLocaleString()}
									{u.lastLoginAt && ` · 最后登录: ${new Date(u.lastLoginAt).toLocaleString()}`}
									{` · 上传次数: ${u.uploadCount}`}
								</div>
							</div>
						</div>
						
						{/* 操作按钮 */}
						<div className="flex gap-2 flex-wrap">
							{/* 🛡️ 超级管理员保护：njumwh@163.com 不显示危险操作 */}
							{u.email === "njumwh@163.com" ? (
								<div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
									<span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
										🛡️ 超级管理员（受保护）
									</span>
								</div>
							) : (
								<>
									{u.role === "USER" ? (
										<button 
											onClick={()=>act(u.id, "promote")} 
											className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
										>
											设为管理员
										</button>
									) : (
										<button 
											onClick={()=>act(u.id, "demote")} 
											className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
										>
											设为普通用户
										</button>
									)}
									
									{u.isBanned ? (
										<button 
											onClick={()=>act(u.id, "unban")} 
											className="px-3 py-1.5 text-xs rounded-lg bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30"
										>
											解封
										</button>
									) : (
										<button 
											onClick={()=>act(u.id, "ban")} 
											className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
										>
											封禁
										</button>
									)}
								</>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function TasksPanel() {
	const [items, setItems] = useState<any[]>([]);
	const [error, setError] = useState<string | null>(null);
	async function load() {
		setError(null);
		const res = await fetch(`/api/logs/task`);
		if (!res.ok) { setError(await res.text()); setItems([]); return; }
		const data = await res.json();
		setItems(data.items ?? []);
	}
	useEffect(()=>{load();},[]);
	return (
		<div className="text-sm space-y-2">
			{error && <div className="text-xs text-red-600">{error}</div>}
			{items.map(x => (
				<div key={x.id} className="grid grid-cols-5 gap-2 border-b border-black/10 py-2">
					<div className="col-span-2 truncate">{x.podcastId}</div>
					<div>{x.type}</div>
					<div>{x.status}</div>
					<div className="text-right">{(x.durationMs ?? 0)}ms</div>
				</div>
			))}
		</div>
	);
}

function CostPanel() {
	const [data, setData] = useState<{ summary: Record<string, { count: number; durationMs: number; estUSD: number }>; totalUSD: number } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const total = useMemo(()=> data ? `$${data.totalUSD.toFixed(4)}`: "—", [data]);
	async function load() {
		setError(null);
		const res = await fetch(`/api/admin/cost`);
		if (!res.ok) { setError(await res.text()); setData(null); return; }
		const d = await res.json();
		setData(d);
	}
	useEffect(()=>{load();},[]);
	return (
		<div className="text-sm space-y-2">
			{error && <div className="text-xs text-red-600">{error}</div>}
			{data && <div className="font-medium">总计：{total}</div>}
			{data && Object.entries(data.summary).map(([k,v]) => (
				<div key={k} className="flex justify-between border-b border-black/10 py-2">
					<div>{k}</div>
					<div>次数 {v.count} · 耗时 {v.durationMs}ms · 估算 ${v.estUSD.toFixed(4)}</div>
				</div>
			))}
		</div>
	);
}
