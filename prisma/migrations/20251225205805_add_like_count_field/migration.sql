-- Add likeCount field to Podcast table for optimizing hot list queries
-- This field caches the count of likes to avoid expensive JOIN queries

-- Step 1: Add the likeCount column with default value 0
ALTER TABLE "Podcast" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;

-- Step 2: Initialize likeCount for existing podcasts
-- This ensures all existing podcasts have the correct like count
UPDATE "Podcast" 
SET "likeCount" = (
  SELECT COUNT(*) 
  FROM "PodcastLike" 
  WHERE "PodcastLike"."podcastId" = "Podcast"."id"
);

-- Step 3: Create indexes for query optimization
CREATE INDEX IF NOT EXISTS "Podcast_likeCount_idx" ON "Podcast"("likeCount");
CREATE INDEX IF NOT EXISTS "Podcast_status_createdAt_idx" ON "Podcast"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Podcast_topicId_status_updatedAt_idx" ON "Podcast"("topicId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Podcast_sourceUrl_status_idx" ON "Podcast"("sourceUrl", "status");

