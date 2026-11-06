-- =====================================================================
-- BD NEWS 24/7 AUTOMATION PLATFORM - MYSQL DATABASE SCHEMA
-- Target Database: alisatec_automation
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Facebook Pages Table
CREATE TABLE IF NOT EXISTS `facebook_pages` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_pages_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. RSS News Sources Table
CREATE TABLE IF NOT EXISTS `rss_sources` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_sources_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. News Articles Ingested Table
CREATE TABLE IF NOT EXISTS `news_articles` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_articles_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Persistent Job Queue Table
CREATE TABLE IF NOT EXISTS `jobs` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_jobs_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Publication Post Logs Table
CREATE TABLE IF NOT EXISTS `post_logs` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_postlogs_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Reel Video Publication Logs Table
CREATE TABLE IF NOT EXISTS `reel_logs` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_reellogs_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Facebook Stories Logs Table
CREATE TABLE IF NOT EXISTS `story_logs` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_storylogs_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. YouTube Upload Logs Table
CREATE TABLE IF NOT EXISTS `youtube_upload_logs` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_ytlogs_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. YouTube Channels Table
CREATE TABLE IF NOT EXISTS `youtube_channels` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_ytchannels_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Facebook Groups for Cross-Posting Table
CREATE TABLE IF NOT EXISTS `facebook_groups` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_groups_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Facebook Group Share Logs Table
CREATE TABLE IF NOT EXISTS `group_share_logs` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_groupsharelogs_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Application Settings Table
CREATE TABLE IF NOT EXISTS `settings` (
  `_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `createdAt` DATETIME NULL,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`_id`),
  INDEX `idx_settings_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

