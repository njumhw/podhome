"use client";

type UserRole = 'visitor' | 'reader' | 'podcaster' | 'vip' | 'admin';

interface UserStatusBadgeProps {
	role: UserRole;
	onClick?: () => void;
}

const roleConfig: Record<UserRole, { label: string; color: string; borderColor: string }> = {
	visitor: {
		label: 'VISITOR',
		color: 'text-cyan-400',
		borderColor: 'border-cyan-400/40',
	},
	reader: {
		label: 'READER',
		color: 'text-emerald-400',
		borderColor: 'border-emerald-400/40',
	},
	podcaster: {
		label: 'PODCASTER',
		color: 'text-fuchsia-500',
		borderColor: 'border-fuchsia-500/40',
	},
	vip: {
		label: 'VIP',
		color: 'text-amber-400',
		borderColor: 'border-amber-400/40',
	},
	admin: {
		label: 'ADMIN',
		color: 'text-rose-500',
		borderColor: 'border-rose-500/40',
	},
};

export function UserStatusBadge({ role, onClick }: UserStatusBadgeProps) {
	const config = roleConfig[role];
	
	// 如果角色不在配置中，使用 visitor 作为默认值
	if (!config) {
		console.warn(`Unknown role: ${role}, using visitor config`);
		const defaultConfig = roleConfig.visitor;
		return (
			<button
				onClick={onClick}
				className={`
					inline-flex items-center justify-center
					px-3 py-1.5
					bg-black/40 dark:bg-black/40 [data-theme='light']:bg-slate-100
					border ${defaultConfig.borderColor}
					rounded
					font-mono text-xs font-semibold uppercase tracking-wider
					${defaultConfig.color}
					transition-colors duration-200
					hover:bg-black/50 dark:hover:bg-black/50 [data-theme='light']:hover:bg-slate-200
					cursor-pointer
				`}
				aria-label={`查看${defaultConfig.label}权限说明`}
			>
				{defaultConfig.label}
			</button>
		);
	}

	return (
		<button
			onClick={onClick}
			className={`
				inline-flex items-center justify-center
				px-3 py-1.5
				bg-black/40 dark:bg-black/40 [data-theme='light']:bg-slate-100
				border ${config.borderColor}
				rounded
				font-mono text-xs font-semibold uppercase tracking-wider
				${config.color}
				transition-colors duration-200
				hover:bg-black/50 dark:hover:bg-black/50 [data-theme='light']:hover:bg-slate-200
				cursor-pointer
			`}
			aria-label={`查看${config.label}权限说明`}
		>
			{config.label}
		</button>
	);
}

