"use client";

import { useState } from "react";

export function EditMeta({ id, detail, onUpdated }: { id: string; detail: any; onUpdated: (d: any)=>void }) {
    const [author, setAuthor] = useState<string>(detail.showAuthor ?? "");
    const [showTitle, setShowTitle] = useState<string>(detail.showTitle ?? "");
    const [pubDate, setPubDate] = useState<string>(detail.publishedAt ? new Date(detail.publishedAt).toISOString().slice(0,10) : "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function save() {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/podcasts/${id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ showAuthor: author.trim() || undefined, showTitle: showTitle.trim() || undefined, publishedAt: pubDate || undefined }),
            });
            const data = await res.json().catch(()=>({}));
            if (!res.ok) throw new Error(data?.error || "保存失败");
            onUpdated(data.item);
        } catch (e:any) {
            setError(e.message || "保存失败");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <label className="w-16 text-sm text-gray-600 dark:text-gray-300">作者</label>
                <input value={author} onChange={(e)=>setAuthor(e.target.value)} className="flex-1 px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 text-sm" placeholder="如 42章经" />
            </div>
            <div className="flex items-center gap-2">
                <label className="w-16 text-sm text-gray-600 dark:text-gray-300">节目名</label>
                <input value={showTitle} onChange={(e)=>setShowTitle(e.target.value)} className="flex-1 px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 text-sm" placeholder="节目名称（可选）" />
            </div>
            <div className="flex items-center gap-2">
                <label className="w-16 text-sm text-gray-600 dark:text-gray-300">发布日期</label>
                <input type="date" value={pubDate} onChange={(e)=>setPubDate(e.target.value)} className="px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 text-sm" />
            </div>
            <div className="flex items-center gap-3 pt-1">
                <button onClick={save} disabled={saving} className="px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-60">{saving?"保存中...":"保存"}</button>
                {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
        </div>
    );
}


