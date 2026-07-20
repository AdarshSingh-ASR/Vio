ALTER TABLE quiz_results ADD COLUMN item_id VARCHAR(255) NULL AFTER user_id;

-- migrate:split
ALTER TABLE quiz_results ADD COLUMN item_name VARCHAR(500) NULL AFTER item_id;

-- migrate:split
ALTER TABLE quiz_results ADD COLUMN time_spent INT NOT NULL DEFAULT 0 AFTER total_questions;

-- migrate:split
ALTER TABLE quiz_results ADD COLUMN percentage DECIMAL(5,2) NULL AFTER time_spent;

-- migrate:split
ALTER TABLE quiz_results ADD COLUMN topic_analysis JSON NULL AFTER percentage;

-- migrate:split
ALTER TABLE quiz_results ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER completed_at;

-- migrate:split
CREATE INDEX idx_quiz_item ON quiz_results(item_id);
