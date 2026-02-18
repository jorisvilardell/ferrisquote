-- Add up migration script here
CREATE TABLE steps (
  id UUID PRIMARY KEY,
  flow_id UUID NOT NULL,
  title VARCHAR(128) NOT NULL,
  description TEXT,
  rank VARCHAR(255) NOT NULL DEFAULT 'n',

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_steps_flows_id FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

CREATE INDEX idx_steps_flows_rank ON steps (flow_id, rank);
