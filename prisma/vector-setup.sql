-- 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector;

-- 为 TranscriptChunk 表添加 embedding 列（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'TranscriptChunk' 
        AND column_name = 'embedding'
    ) THEN
        ALTER TABLE "TranscriptChunk" ADD COLUMN embedding vector(1536);
    END IF;
END $$;

-- 创建 ivfflat 索引（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'TranscriptChunk' 
        AND indexname = 'transcriptchunk_embedding_idx'
    ) THEN
        CREATE INDEX transcriptchunk_embedding_idx ON "TranscriptChunk" 
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    END IF;
END $$;

-- 验证设置
SELECT 
    'pgvector extension' as check_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') 
         THEN '✅ 已启用' 
         ELSE '❌ 未启用' 
    END as status
UNION ALL
SELECT 
    'embedding column' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'TranscriptChunk' AND column_name = 'embedding'
    ) 
    THEN '✅ 已创建' 
    ELSE '❌ 未创建' 
    END as status
UNION ALL
SELECT 
    'ivfflat index' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'TranscriptChunk' 
        AND indexname = 'transcriptchunk_embedding_idx'
    ) 
    THEN '✅ 已创建' 
    ELSE '❌ 未创建' 
    END as status;
