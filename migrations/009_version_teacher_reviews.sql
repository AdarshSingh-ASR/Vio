ALTER TABLE teacher_reviews
  ADD INDEX idx_review_submission (submission_id);

-- migrate:split
ALTER TABLE teacher_reviews
  DROP INDEX uq_teacher_review,
  ADD UNIQUE KEY uq_teacher_review_version (submission_version_id);
