ALTER TABLE user_memories
  ADD COLUMN memory_key VARCHAR(255) NULL AFTER scope_id,
  ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'user_explicit' AFTER content,
  ADD COLUMN sensitivity ENUM('normal','restricted') NOT NULL DEFAULT 'normal' AFTER source,
  ADD INDEX idx_memory_key (user_id, scope_type, scope_id, memory_key, superseded_by);

-- migrate:split
ALTER TABLE knowledge_documents
  ADD COLUMN attempt_count INT NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN processed_at TIMESTAMP NULL AFTER error_message;

