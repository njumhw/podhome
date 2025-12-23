-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('READER', 'PODCASTER', 'PODCASTER_VIP', 'ADMIN', 'USER', 'GUEST');

-- CreateEnum
CREATE TYPE "PodcastStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('TRANSCRIBE', 'CLEAN', 'IDENTIFY', 'SUMMARIZE', 'CHUNK', 'EMBED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "uploadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "targetRole" "UserRole" NOT NULL DEFAULT 'PODCASTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "usedById" TEXT,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Podcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "audioUrl" TEXT,
    "description" TEXT,
    "guests" TEXT,
    "publishedAt" TIMESTAMP(3),
    "episodeNumber" TEXT,
    "duration" INTEGER,
    "fileSize" BIGINT,
    "language" TEXT DEFAULT 'zh',
    "status" "PodcastStatus" NOT NULL DEFAULT 'PROCESSING',
    "originalTranscript" TEXT,
    "transcript" TEXT,
    "summary" TEXT,
    "reportOutline" TEXT,
    "translatedTranscript" TEXT,
    "translatedSummary" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "topicId" TEXT,
    "showAuthor" TEXT,
    "showTitle" TEXT,

    CONSTRAINT "Podcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptChunk" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "startSec" INTEGER NOT NULL,
    "endSec" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "TranscriptChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT,
    "userId" TEXT,
    "userIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audioCacheId" TEXT,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLog" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "durationMs" INTEGER,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "tokens" INTEGER,
    "duration" INTEGER,
    "cost" DECIMAL(65,30),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsageLog" (
    "id" TEXT NOT NULL,
    "apiType" TEXT NOT NULL,
    "duration" INTEGER,
    "tokens" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioCache" (
    "id" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "duration" INTEGER,
    "transcript" TEXT,
    "script" TEXT,
    "summary" TEXT,
    "translatedTranscript" TEXT,
    "translatedSummary" TEXT,
    "segments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "originalUrl" TEXT,
    "topicId" TEXT,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "AudioCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityLog" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "completeness" DOUBLE PRECISION NOT NULL,
    "consistency" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "processingTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskQueue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TaskQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "podcastId" TEXT,
    "audioCacheId" TEXT,
    "userId" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastLike" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "userId" TEXT,
    "userIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodcastLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MulerunSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MulerunSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MulerunQueryHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "podcastId" TEXT,
    "queryUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "meteringId" TEXT,
    "costCredits" DOUBLE PRECISION,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3),

    CONSTRAINT "MulerunQueryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "Topic"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_name_key" ON "Prompt"("name");

-- CreateIndex
CREATE INDEX "Podcast_status_updatedAt_idx" ON "Podcast"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TranscriptChunk_podcastId_idx" ON "TranscriptChunk"("podcastId");

-- CreateIndex
CREATE INDEX "AccessLog_podcastId_createdAt_idx" ON "AccessLog"("podcastId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_audioCacheId_createdAt_idx" ON "AccessLog"("audioCacheId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_userIp_userAgent_createdAt_idx" ON "AccessLog"("userIp", "userAgent", "createdAt");

-- CreateIndex
CREATE INDEX "TaskLog_podcastId_type_createdAt_idx" ON "TaskLog"("podcastId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "ApiUsage_service_createdAt_idx" ON "ApiUsage"("service", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsageLog_apiType_timestamp_idx" ON "ApiUsageLog"("apiType", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "AudioCache_audioUrl_key" ON "AudioCache"("audioUrl");

-- CreateIndex
CREATE INDEX "AudioCache_audioUrl_idx" ON "AudioCache"("audioUrl");

-- CreateIndex
CREATE INDEX "AudioCache_originalUrl_idx" ON "AudioCache"("originalUrl");

-- CreateIndex
CREATE INDEX "AudioCache_topicId_idx" ON "AudioCache"("topicId");

-- CreateIndex
CREATE INDEX "AudioCache_updatedAt_idx" ON "AudioCache"("updatedAt");

-- CreateIndex
CREATE INDEX "QualityLog_podcastId_idx" ON "QualityLog"("podcastId");

-- CreateIndex
CREATE INDEX "QualityLog_createdAt_idx" ON "QualityLog"("createdAt");

-- CreateIndex
CREATE INDEX "QualityLog_overall_idx" ON "QualityLog"("overall");

-- CreateIndex
CREATE INDEX "TaskQueue_status_idx" ON "TaskQueue"("status");

-- CreateIndex
CREATE INDEX "TaskQueue_createdAt_idx" ON "TaskQueue"("createdAt");

-- CreateIndex
CREATE INDEX "TaskQueue_type_idx" ON "TaskQueue"("type");

-- CreateIndex
CREATE INDEX "Comment_podcastId_createdAt_idx" ON "Comment"("podcastId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_audioCacheId_createdAt_idx" ON "Comment"("audioCacheId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "CommentLike_commentId_idx" ON "CommentLike"("commentId");

-- CreateIndex
CREATE INDEX "CommentLike_userId_idx" ON "CommentLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentLike_commentId_userId_key" ON "CommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX "PodcastLike_podcastId_idx" ON "PodcastLike"("podcastId");

-- CreateIndex
CREATE INDEX "PodcastLike_userId_idx" ON "PodcastLike"("userId");

-- CreateIndex
CREATE INDEX "PodcastLike_userIp_idx" ON "PodcastLike"("userIp");

-- CreateIndex
CREATE UNIQUE INDEX "PodcastLike_podcastId_userId_userIp_key" ON "PodcastLike"("podcastId", "userId", "userIp");

-- CreateIndex
CREATE UNIQUE INDEX "MulerunSession_sessionId_key" ON "MulerunSession"("sessionId");

-- CreateIndex
CREATE INDEX "MulerunSession_sessionId_idx" ON "MulerunSession"("sessionId");

-- CreateIndex
CREATE INDEX "MulerunSession_userId_idx" ON "MulerunSession"("userId");

-- CreateIndex
CREATE INDEX "MulerunSession_expiresAt_idx" ON "MulerunSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MulerunQueryHistory_meteringId_key" ON "MulerunQueryHistory"("meteringId");

-- CreateIndex
CREATE INDEX "MulerunQueryHistory_sessionId_idx" ON "MulerunQueryHistory"("sessionId");

-- CreateIndex
CREATE INDEX "MulerunQueryHistory_status_idx" ON "MulerunQueryHistory"("status");

-- CreateIndex
CREATE INDEX "MulerunQueryHistory_timeoutAt_idx" ON "MulerunQueryHistory"("timeoutAt");

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Podcast" ADD CONSTRAINT "Podcast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Podcast" ADD CONSTRAINT "Podcast_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptChunk" ADD CONSTRAINT "TranscriptChunk_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_audioCacheId_fkey" FOREIGN KEY ("audioCacheId") REFERENCES "AudioCache"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLog" ADD CONSTRAINT "TaskLog_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioCache" ADD CONSTRAINT "AudioCache_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_audioCacheId_fkey" FOREIGN KEY ("audioCacheId") REFERENCES "AudioCache"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastLike" ADD CONSTRAINT "PodcastLike_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastLike" ADD CONSTRAINT "PodcastLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MulerunQueryHistory" ADD CONSTRAINT "MulerunQueryHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MulerunSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MulerunQueryHistory" ADD CONSTRAINT "MulerunQueryHistory_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
