-- Add up migration script here
CREATE TABLE fields (
  id UUID PRIMARY KEY,
  steps_id UUID NOT NULL,
  "key" VARCHAR(32) NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  rank VARCHAR(255) NOT NULL DEFAULT 'n',

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_fields_steps_id FOREIGN KEY (steps_id) REFERENCES steps(id) ON DELETE CASCADE
);

CREATE INDEX idx_fields_steps_rank ON fields (steps_id, rank);
