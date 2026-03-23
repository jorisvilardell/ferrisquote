CREATE TABLE estimators (
  id UUID PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_estimators_flow_id ON estimators (flow_id);
