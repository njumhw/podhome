import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type PodcastLite = {
	id: string;
	title: string | null;
	sourceUrl: string | null;
	summary: string | null;
	createdAt: Date;
	processingCompletedAt: Date | null;
};

function pickKey(p: PodcastLite): string {
	if (p.sourceUrl && p.sourceUrl.trim().length > 0) return p.sourceUrl.trim();
	if (p.title && p.title.trim().length > 0) return p.title.trim().toLowerCase();
	return p.id;
}

function sortCandidates(group: PodcastLite[]) {
	return [...group].sort((a, b) => {
		const summaryDiff =
			(b.summary?.length ?? 0) - (a.summary?.length ?? 0);
		if (summaryDiff !== 0) return summaryDiff;
		const timeA =
			(b.processingCompletedAt ?? b.createdAt ?? new Date(0)).getTime();
		const timeB =
			(a.processingCompletedAt ?? a.createdAt ?? new Date(0)).getTime();
		return timeA - timeB;
	});
}

async function moveRelations(
	dupId: string,
	targetId: string
): Promise<void> {
	await prisma.$transaction(async (tx) => {
		await tx.podcastLike.updateMany({
			where: { podcastId: dupId },
			data: { podcastId: targetId },
		});
		await tx.comment.updateMany({
			where: { podcastId: dupId },
			data: { podcastId: targetId },
		});
		await tx.transcriptChunk.updateMany({
			where: { podcastId: dupId },
			data: { podcastId: targetId },
		});
		await tx.accessLog.updateMany({
			where: { podcastId: dupId },
			data: { podcastId: targetId },
		});
		await tx.taskLog.updateMany({
			where: { podcastId: dupId },
			data: { podcastId: targetId },
		});
		await tx.podcast.delete({ where: { id: dupId } });
	});
}

async function main() {
	console.log("🔍 开始扫描播客重复记录...");
	await prisma.$executeRawUnsafe(`SET statement_timeout = 60000`);
	const podcasts = await prisma.podcast.findMany({
		select: {
			id: true,
			title: true,
			sourceUrl: true,
			summary: true,
			createdAt: true,
			processingCompletedAt: true,
		},
	});

	const groups = new Map<string, PodcastLite[]>();
	for (const p of podcasts) {
		const key = pickKey(p);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(p);
	}

	const duplicateGroups = [...groups.entries()].filter(
		([, list]) => list.length > 1
	);

	if (duplicateGroups.length === 0) {
		console.log("✅ 未发现重复播客记录。");
		return;
	}

	console.log(`⚠️ 发现 ${duplicateGroups.length} 组重复记录，准备去重...`);

	let removed = 0;
	for (const [key, list] of duplicateGroups) {
		const sorted = sortCandidates(list);
		const keeper = sorted[0];
		const duplicates = sorted.slice(1);

		console.log(
			`\n保留 => ${keeper.id} | ${keeper.title ?? "(无标题)"} | summary ${
				keeper.summary?.length ?? 0
			} 字 | key=${key}`
		);
		for (const dup of duplicates) {
			console.log(
				`  删除 => ${dup.id} | summary ${
					dup.summary?.length ?? 0
				} 字 | created=${dup.createdAt.toISOString()}`
			);
			await moveRelations(dup.id, keeper.id);
			removed += 1;
		}
	}

	console.log(`\n🎉 去重完成，删除重复纪录 ${removed} 条。`);
}

main()
	.catch((err) => {
		console.error("❌ 去重失败：", err);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});

