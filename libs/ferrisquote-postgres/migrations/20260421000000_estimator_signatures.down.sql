ALTER TABLE estimators
  DROP COLUMN IF EXISTS inputs,
  DROP COLUMN IF EXISTS outputs;

CREATE TABLE IF NOT EXISTS estimator_variables (
  id UUID PRIMARY KEY,
  estimator_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  expression TEXT NOT NULL,
  description TEXT,
  rank VARCHAR(255) NOT NULL DEFAULT 'n',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_estimator_variables_estimator_id FOREIGN KEY (estimator_id) REFERENCES estimators(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_estimator_variables_estimator_id ON estimator_variables (estimator_id);
