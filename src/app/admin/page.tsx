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
	const [active, setActive] = useState<"invites" | "topics" | "users" | "cost" | "audio" | "prompts" | "podcasts">("invites");

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
				{(["invites","topics","users","cost","audio","prompts","podcasts"] as const).map(k => (
					<button key={k} onClick={() => setActive(k)} className={`px-3 py-1.5 text-sm rounded-lg ${active===k?"bg-black text-white dark:bg-white dark:text-black":"text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10"}`}>{label(k)}</button>
				))}
			</div>

			{active === "invites" && <InvitesPanel />}
			{active === "topics" && <TopicsPanel />}
			{active === "users" && <UsersPanel />}
			{active === "cost" && <CostPanel />}
			{active === "audio" && <AudioConfigPanel />}
			{active === "prompts" && <PromptManager />}
			{active === "podcasts" && <PodcastsPanel />}
		</div>
	);
}

function label(k: string) {
	return (
		{
			invites: "邀请码",
			topics: "主题审核",
			users: "用户管理",
			cost: "成本监控",
			audio: "音频配置",
			prompts: "提示词管理",
			podcasts: "播客管理",
		} as Record<string, string>
	)[k];
}

function InvitesPanel() {
	const [count, setCount] = useState(1);
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
			const res = await fetch("/api/admin/invite/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ count }) });
			if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
			await loadCodes(); // 重新加载邀请码列表
		} catch (e: any) { setError(e.message || "请求失败"); }
		finally { setLoading(false); }
	}
	
	useEffect(() => { loadCodes(); }, []);
	return (
		<div className="space-y-3">
			<div className="flex gap-2 items-center text-sm">
				<input type="number" min={1} max={100} value={count} onChange={(e)=>setCount(+e.target.value)} className="w-20 rounded-lg border border-black/10 px-2 py-1 text-sm bg-white/60 dark:bg-black/40" />
				<button onClick={create} disabled={loading} className="px-3 py-1.5 text-sm rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-50">生成</button>
			</div>
			{error && <div className="text-xs text-red-600 p-2 bg-red-50 dark:bg-red-900/20 rounded">{error}</div>}
			{items.length>0 && (
				<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
					<div className="p-2 border-b border-gray-200 bg-gray-50">
						<div className="font-medium text-sm text-gray-900">邀请码列表</div>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-gray-50 border-b border-gray-200">
								<tr>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">邀请码</th>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">使用状态</th>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">使用者</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{items.map((it,i)=>(
									<tr key={it.id} className="hover:bg-gray-50">
										<td className="px-3 py-2">
											<div className="font-mono font-medium text-gray-900">{it.code}</div>
										</td>
										<td className="px-3 py-2 text-gray-600">
											<div className="text-xs">
												{it.uses}/{it.maxUses} 次使用
												{it.expiresAt ? (
													<div className="text-gray-500 mt-0.5">过期: {new Date(it.expiresAt).toLocaleDateString('zh-CN')}</div>
												) : (
													<div className="text-gray-500 mt-0.5">永不过期</div>
												)}
											</div>
										</td>
										<td className="px-3 py-2">
											{it.usedBy ? (
												<div className="text-xs">
													<div className="text-gray-900 font-medium">{it.usedBy.username}</div>
													<div className="text-gray-600">{it.usedBy.email}</div>
													<div className="text-gray-500 mt-0.5">
														{it.usedBy.role} · {new Date(it.usedBy.createdAt).toLocaleDateString('zh-CN')}
													</div>
												</div>
											) : (
												<span className="text-gray-400 text-xs">未使用</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
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
										<div className="font-medium text-gray-900">{topic.name}</div>
										{topic.description && (
											<div className="text-sm text-gray-700">{topic.description}</div>
										)}
										<div className="text-xs text-gray-600">
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
	async function act(userId: string, action: "promote"|"demote"|"ban"|"unban"|"set_vip"|"remove_vip"|"upgrade_to_podcaster") {
		const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, action }) });
		if (!res.ok) { setError(await res.text()); return; }
		load();
	}
	
	function getRoleBadge(role: string) {
		const roleMap: Record<string, { label: string; colors: string }> = {
			READER: { label: "读者", colors: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
			PODCASTER: { label: "创作者", colors: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" },
			PODCASTER_VIP: { label: "VIP创作者", colors: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300" },
			ADMIN: { label: "管理员", colors: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" },
			USER: { label: "普通用户", colors: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
		};
		const roleInfo = roleMap[role] || { label: role, colors: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" };
		return <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleInfo.colors}`}>{roleInfo.label}</span>;
	}
	
	function getStatusBadge(isBanned: boolean) {
		if (isBanned) {
			return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">已封禁</span>;
		}
		return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">正常</span>;
	}
	
	return (
		<div className="space-y-4">
			{error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</div>}
			
			<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<div className="p-2 border-b border-gray-200 bg-gray-50">
					<h3 className="font-medium text-sm text-gray-900">共 {items.length} 个用户</h3>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 border-b border-gray-200">
							<tr>
								<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">用户名</th>
								<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">角色</th>
								<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">状态</th>
								<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">邮箱</th>
								<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">注册时间</th>
								<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">最后登录</th>
								<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">上传次数</th>
								<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">操作</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{items.map(u => (
								<tr key={u.id} className="hover:bg-gray-50">
									<td className="px-3 py-2">
										<div className="font-medium text-gray-900">{u.username}</div>
									</td>
									<td className="px-3 py-2">
										{getRoleBadge(u.role)}
									</td>
									<td className="px-3 py-2">
										{getStatusBadge(u.isBanned)}
									</td>
									<td className="px-3 py-2 text-gray-600">
										<div className="truncate max-w-xs" title={u.email}>
											{u.email}
										</div>
									</td>
									<td className="px-3 py-2 text-gray-600 text-xs">
										{new Date(u.createdAt).toLocaleDateString('zh-CN')}
									</td>
									<td className="px-3 py-2 text-gray-600 text-xs">
										{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('zh-CN') : '-'}
									</td>
									<td className="px-3 py-2 text-gray-600">
										{u.uploadCount || 0}
									</td>
									<td className="px-3 py-2">
										<div className="flex items-center gap-1">
											{/* 🛡️ 超级管理员保护：njumwh@163.com 不显示危险操作 */}
											{u.email === "njumwh@163.com" ? (
												<span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-800">
													🛡️ 受保护
												</span>
											) : (
												<>
													{u.role === "ADMIN" ? (
														<button 
															onClick={()=>act(u.id, "demote")} 
															className="px-2 py-1 text-xs rounded bg-gray-600 text-white hover:bg-gray-700"
														>
															降级
														</button>
													) : u.role === "PODCASTER_VIP" ? (
														<>
															<button 
																onClick={()=>act(u.id, "remove_vip")} 
																className="px-2 py-1 text-xs rounded bg-gray-600 text-white hover:bg-gray-700"
															>
																取消VIP
															</button>
														</>
													) : u.role === "PODCASTER" ? (
														<>
															<button 
																onClick={()=>act(u.id, "set_vip")} 
																className="px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700"
															>
																设为VIP
															</button>
														</>
													) : u.role === "READER" ? (
														<>
															<button 
																onClick={()=>act(u.id, "upgrade_to_podcaster")} 
																className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
															>
																升级为创作者
															</button>
														</>
													) : null}
													
													{u.isBanned ? (
														<button 
															onClick={()=>act(u.id, "unban")} 
															className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
														>
															解封
														</button>
													) : (
														<button 
															onClick={()=>act(u.id, "ban")} 
															className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
														>
															封禁
														</button>
													)}
												</>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
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

// 播客管理面板
function PodcastsPanel() {
	const [podcasts, setPodcasts] = useState<any[]>([]);
	const [topics, setTopics] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [status, setStatus] = useState('all');
	const [search, setSearch] = useState('');
	const [summary, setSummary] = useState<{
		totalPodcasts: number;
		totalTasks: number;
		readyPodcasts: number;
		processingPodcasts: number;
		failedPodcasts: number;
		totalProcessingDurationMs: number;
		totalDurationSeconds: number;
		refreshedAt: string;
	} | null>(null);

	const loadPodcasts = async () => {
		setLoading(true);
		setError(null);
		try {
			const needsRefresh = summary === null;
			const params = new URLSearchParams({
				page: page.toString(),
				limit: '20',
				status,
				...(search && { search })
			});
			if (needsRefresh) params.set('refresh', '1');

			const res = await fetch(`/api/admin/podcasts?${params}`);
			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || '加载失败');
			}

			const data = await res.json();
			setPodcasts(data.podcasts || []);
			setTotalPages(data.pagination?.totalPages || 1);
			setSummary(data.summary || null);
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const loadTopics = async () => {
		try {
			const res = await fetch('/api/admin/topics');
			if (res.ok) {
				const data = await res.json();
				// 只显示已审核的主题
				setTopics((data.topics || []).filter((t: any) => t.approved));
			}
		} catch (err) {
			console.error('加载主题失败:', err);
		}
	};

	const updatePodcastTopic = async (podcastId: string, topicId: string) => {
		try {
			const res = await fetch('/api/podcast/topic', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					podcastId,
					topicId: topicId || undefined
				})
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || '更新失败');
			}

			// 重新加载播客列表
			loadPodcasts();
		} catch (err: any) {
			setError(err.message || '更新主题失败');
		}
	};

	useEffect(() => {
		loadPodcasts();
		loadTopics();
	}, [page, status, search]);

	const deletePodcast = async (id: string, title: string) => {
		if (!confirm(`确定要删除播客 "${title}" 吗？\n\n此操作将删除播客及其所有相关数据（访问日志、任务日志、转录片段等），且无法恢复。`)) {
			return;
		}

		try {
			const res = await fetch(`/api/admin/podcasts?id=${id}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || '删除失败');
			}

			// 重新加载列表
			loadPodcasts();
		} catch (err: any) {
			setError(err.message);
		}
	};

	const getStatusBadge = (status: string) => {
		const statusMap = {
			'PENDING': { text: '等待中', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' },
			'PROCESSING': { text: '处理中', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' },
			'READY': { text: '已完成', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' },
			'FAILED': { text: '失败', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' }
		};

		const statusInfo = statusMap[status as keyof typeof statusMap] || { text: status, color: 'bg-gray-100 text-gray-800' };
		
		return (
			<span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
				{statusInfo.text}
			</span>
		);
	};

	const formatDuration = (seconds: number | null) => {
		if (!seconds) return '-';
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
	};

	const formatDate = (date: string | null) => {
		if (!date) return '-';
		return new Date(date).toLocaleString('zh-CN');
	};

	const formatHours = (hours: number) => `${(Math.round(hours * 10) / 10).toLocaleString()} 小时`;

	const formatAudioDuration = (seconds: number | null | undefined) => {
		if (!seconds) return '0 小时';
		const hours = seconds / 3600;
		return formatHours(hours);
	};

	const formatTotalDuration = (ms: number | null | undefined) => {
		if (!ms) return '0 小时';
		const hours = ms / 3_600_000;
		return formatHours(hours);
	};

	return (
		<div className="space-y-6">
			{error && (
				<div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
					{error}
				</div>
			)}

			{/* 全量统计信息 */}
			{summary && (
				<div className="grid grid-cols-2 md:grid-cols-6 gap-4">
					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<div className="text-xs text-gray-500">总播客</div>
						<div className="text-2xl font-bold text-gray-900 mt-1">{summary.totalPodcasts}</div>
					</div>
					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<div className="text-xs text-gray-500">已完成</div>
						<div className="text-2xl font-bold text-green-600 mt-1">{summary.readyPodcasts}</div>
					</div>
					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<div className="text-xs text-gray-500">处理中</div>
						<div className="text-2xl font-bold text-blue-600 mt-1">{summary.processingPodcasts}</div>
					</div>
					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<div className="text-xs text-gray-500">失败</div>
						<div className="text-2xl font-bold text-red-600 mt-1">{summary.failedPodcasts}</div>
					</div>
					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<div className="text-xs text-gray-500">累计任务</div>
						<div className="text-2xl font-bold text-purple-600 mt-1">{summary.totalTasks}</div>
					</div>
					<div className="bg-white border border-gray-200 rounded-lg p-4">
						<div className="text-xs text-gray-500">总音频时长（去重）</div>
						<div className="text-2xl font-bold text-gray-900 mt-1">
							{formatAudioDuration(summary.totalDurationSeconds)}
						</div>
						<div className="text-xs text-gray-500 mt-1">仅统计已完成播客</div>
					</div>
					<div className="bg-white border border-gray-200 rounded-lg p-4 md:col-span-2">
						<div className="text-xs text-gray-500">累计处理时长（去重）</div>
						<div className="text-2xl font-bold text-gray-900 mt-1">
							{formatTotalDuration(summary.totalProcessingDurationMs)}
						</div>
						<div className="text-xs text-gray-500 mt-1">仅统计已完成播客</div>
					</div>
				</div>
			)}
			{summary && (
				<div className="text-xs text-gray-500">
					数据每小时刷新 · 上次更新 {new Date(summary.refreshedAt).toLocaleString('zh-CN')}
				</div>
			)}

			{/* 筛选和搜索 */}
			<div className="bg-white border border-gray-200 rounded-lg p-4">
				<div className="flex flex-col md:flex-row gap-4">
					<div className="flex-1">
						<input
							type="text"
							placeholder="搜索播客标题、作者或URL..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full p-2 border border-gray-300 rounded-lg text-sm"
						/>
					</div>
					<div>
						<select
							value={status}
							onChange={(e) => setStatus(e.target.value)}
							className="p-2 border border-gray-300 rounded-lg text-sm"
						>
							<option value="all">全部状态</option>
							<option value="PENDING">等待中</option>
							<option value="PROCESSING">处理中</option>
							<option value="READY">已完成</option>
							<option value="FAILED">失败</option>
						</select>
					</div>
				</div>
			</div>

			{/* 播客列表 - 紧凑表格布局 */}
			<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<div className="p-3 border-b border-gray-200 bg-gray-50">
					<h3 className="font-medium text-sm">播客列表</h3>
				</div>
				
				{loading ? (
					<div className="p-8 text-center text-gray-500 text-sm">加载中...</div>
				) : podcasts.length === 0 ? (
					<div className="p-8 text-center text-gray-500 text-sm">暂无播客</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-gray-50 border-b border-gray-200">
								<tr>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-1/3">标题</th>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-20">状态</th>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-24">作者</th>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-16">时长</th>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-28">主题</th>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-32">创建时间</th>
									<th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-24">操作</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{podcasts.map((podcast) => (
									<tr key={podcast.id} className="hover:bg-gray-50">
										<td className="px-3 py-2">
											<div className="truncate max-w-md text-gray-900 font-medium" title={podcast.title}>
												{podcast.title}
											</div>
										</td>
										<td className="px-3 py-2">
											{getStatusBadge(podcast.status)}
										</td>
										<td className="px-3 py-2 text-gray-600">
											<div className="truncate max-w-24" title={podcast.showAuthor || '-'}>
												{podcast.showAuthor || '-'}
											</div>
										</td>
										<td className="px-3 py-2 text-gray-600">
											{formatDuration(podcast.duration)}
										</td>
										<td className="px-3 py-2">
											<div className="flex items-center gap-1">
												{podcast.topic ? (
													<span 
														className="px-1.5 py-0.5 rounded text-xs whitespace-nowrap"
														style={{ 
															backgroundColor: podcast.topic.color + '20',
															color: podcast.topic.color 
														}}
													>
														{podcast.topic.name}
													</span>
												) : (
													<span className="text-xs text-gray-400">未分类</span>
												)}
												<select
													value={podcast.topic?.id || ''}
													onChange={(e) => updatePodcastTopic(podcast.id, e.target.value)}
													className="ml-1 px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-white min-w-20"
													onClick={(e) => e.stopPropagation()}
												>
													<option value="">移除</option>
													{topics.map(topic => (
														<option key={topic.id} value={topic.id}>
															{topic.name}
														</option>
													))}
												</select>
											</div>
										</td>
										<td className="px-3 py-2 text-gray-600 text-xs">
											{formatDate(podcast.createdAt)}
										</td>
										<td className="px-3 py-2">
											<div className="flex items-center gap-1">
												<Link
													href={`/podcast/${podcast.id}`}
													target="_blank"
													className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
												>
													查看
												</Link>
												<button
													onClick={() => deletePodcast(podcast.id, podcast.title)}
													className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
												>
													删除
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* 分页 */}
			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-2">
					<button
						onClick={() => setPage(Math.max(1, page - 1))}
						disabled={page === 1}
						className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						上一页
					</button>
					<span className="px-3 py-1.5 text-sm text-gray-600">
						{page} / {totalPages}
					</span>
					<button
						onClick={() => setPage(Math.min(totalPages, page + 1))}
						disabled={page === totalPages}
						className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						下一页
					</button>
				</div>
			)}
		</div>
	);
}
