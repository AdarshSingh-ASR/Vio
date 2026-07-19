ALTER TABLE agent_runs
  ADD COLUMN trace_id VARCHAR(64) NULL AFTER id,
  ADD INDEX idx_agent_runs_trace (trace_id);

-- migrate:split
ALTER TABLE tool_executions
  ADD COLUMN trace_id VARCHAR(64) NULL AFTER id,
  ADD INDEX idx_tool_executions_trace (trace_id);

-- migrate:split
ALTER TABLE ai_usage_events
  ADD COLUMN trace_id VARCHAR(64) NULL AFTER id,
  ADD INDEX idx_ai_usage_trace (trace_id);

-- migrate:split
ALTER TABLE audit_events
  ADD COLUMN trace_id VARCHAR(64) NULL AFTER id,
  ADD INDEX idx_audit_trace (trace_id);
