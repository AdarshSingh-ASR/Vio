-- Remove the retired Codex runtime integration and destroy stored connector tokens.
DELETE FROM ai_credentials WHERE provider = 'codex';

ALTER TABLE ai_credentials
  MODIFY COLUMN provider ENUM('openai') NOT NULL;

ALTER TABLE user_ai_preferences
  DROP COLUMN agent_engine;

ALTER TABLE conversations
  DROP COLUMN external_thread_id,
  DROP COLUMN engine;
