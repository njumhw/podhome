"use client";

type UserRole = 'visitor' | 'reader' | 'podcaster' | 'vip' | 'admin';

interface UserStatusBadgeProps {
	role: UserRole;
	onClick?: () => void;
}

const roleConfig: Record<UserRole, { 
	label: string;
}> = {
	visitor: {
		label: 'VISITOR',
	},
	reader: {
		label: 'READER',
	},
	podcaster: {
		label: 'PODCASTER',
	},
	vip: {
		label: 'VIP',
	},
	admin: {
		label: 'ADMIN',
	},
};

export function UserStatusBadge({ role, onClick }: UserStatusBadgeProps) {
	const config = roleConfig[role];
	
	// 统一的样式，所有角色都一样 - 仅文字，无边框，橙色
	const baseClassName = `
		inline-flex items-center justify-center
		font-mono text-xs font-semibold uppercase tracking-wider
		text-orange-400 dark:text-orange-400 [data-theme='light']:text-orange-600
		transition-colors duration-200
		hover:text-orange-300 dark:hover:text-orange-300 [data-theme='light']:hover:text-orange-700
		cursor-pointer
	`;

	// 如果角色不在配置中，使用 visitor 作为默认值
	if (!config) {
		console.warn(`Unknown role: ${role}, using visitor config`);
		const defaultConfig = roleConfig.visitor;
		return (
			<button
				onClick={onClick}
				className={baseClassName}
				aria-label={`查看${defaultConfig.label}权限说明`}
			>
				{defaultConfig.label}
			</button>
		);
	}

	return (
		<button
			onClick={onClick}
			className={baseClassName}
			aria-label={`查看${config.label}权限说明`}
		>
			{config.label}
		</button>
	);
}

