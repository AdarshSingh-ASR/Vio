ALTER TABLE user_memories
  ADD COLUMN IF NOT EXISTS memory_key VARCHAR(255) NULL AFTER scope_id,
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'user_explicit' AFTER content;

-- migrate:split
ALTER TABLE user_memories
  ADD INDEX IF NOT EXISTS idx_memory_key (user_id(128), scope_type, scope_id(128), memory_key(128), superseded_by);

-- migrate:split
ALTER TABLE user_memories
  ADD COLUMN IF NOT EXISTS sensitivity ENUM('normal','restricted') NOT NULL DEFAULT 'normal' AFTER source;

-- migrate:split
ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP NULL AFTER error_message;
