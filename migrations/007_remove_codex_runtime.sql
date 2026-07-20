-- Remove the retired Codex runtime integration and destroy stored connector tokens.
DELETE FROM ai_credentials WHERE provider = 'codex';

-- migrate:split
ALTER TABLE ai_credentials
  MODIFY COLUMN provider ENUM('openai') NOT NULL;

-- migrate:split
ALTER TABLE user_ai_preferences
  DROP COLUMN agent_engine;

-- migrate:split
ALTER TABLE conversations
  DROP COLUMN external_thread_id,
  DROP COLUMN engine;
