ALTER TABLE knowledge_documents
  ADD COLUMN embedding_status ENUM('pending', 'ready', 'failed', 'disabled') NOT NULL DEFAULT 'pending' AFTER status;

-- migrate:split
ALTER TABLE knowledge_documents
  ADD COLUMN embedding_model VARCHAR(255) NULL AFTER embedding_status;

-- migrate:split
ALTER TABLE knowledge_chunks
  ADD COLUMN embedding_vector VECTOR(768) NULL AFTER embedding;
