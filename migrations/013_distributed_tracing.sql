ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS trace_id VARCHAR(64) NULL AFTER id;
-- migrate:split
ALTER TABLE agent_runs
  ADD INDEX IF NOT EXISTS idx_agent_runs_trace (trace_id);

-- migrate:split
ALTER TABLE tool_executions
  ADD COLUMN IF NOT EXISTS trace_id VARCHAR(64) NULL AFTER id;
-- migrate:split
ALTER TABLE tool_executions
  ADD INDEX IF NOT EXISTS idx_tool_executions_trace (trace_id);

-- migrate:split
ALTER TABLE ai_usage_events
  ADD COLUMN IF NOT EXISTS trace_id VARCHAR(64) NULL AFTER id;
-- migrate:split
ALTER TABLE ai_usage_events
  ADD INDEX IF NOT EXISTS idx_ai_usage_trace (trace_id);

-- migrate:split
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS trace_id VARCHAR(64) NULL AFTER id;
-- migrate:split
ALTER TABLE audit_events
  ADD INDEX IF NOT EXISTS idx_audit_trace (trace_id);
