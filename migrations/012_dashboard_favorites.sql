ALTER TABLE dashboard_items
  ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE AFTER appwrite_bucket_id;

-- migrate:split
ALTER TABLE dashboard_items
  ADD INDEX idx_dashboard_items_favorite (created_by, favorite, updated_at);
