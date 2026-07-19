INSERT IGNORE INTO conversations (id, user_id, title, engine, status, created_at, updated_at)
SELECT
  LOWER(CONCAT(
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 1, 8), '-',
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 9, 4), '-4',
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 14, 3), '-a',
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 18, 3), '-',
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 21, 12)
  )),
  user_id,
  'Migrated conversation',
  'vio',
  'active',
  MIN(timestamp),
  MAX(timestamp)
FROM chat_messages
GROUP BY user_id, chat_id;

-- migrate:split
INSERT IGNORE INTO conversation_messages (id, conversation_id, role, content, status, created_at)
SELECT
  LOWER(CONCAT(
    SUBSTR(SHA2(CONCAT('message:', id), 256), 1, 8), '-',
    SUBSTR(SHA2(CONCAT('message:', id), 256), 9, 4), '-4',
    SUBSTR(SHA2(CONCAT('message:', id), 256), 14, 3), '-a',
    SUBSTR(SHA2(CONCAT('message:', id), 256), 18, 3), '-',
    SUBSTR(SHA2(CONCAT('message:', id), 256), 21, 12)
  )),
  LOWER(CONCAT(
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 1, 8), '-',
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 9, 4), '-4',
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 14, 3), '-a',
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 18, 3), '-',
    SUBSTR(SHA2(CONCAT(user_id, ':', chat_id), 256), 21, 12)
  )),
  role,
  content,
  'completed',
  timestamp
FROM chat_messages;
