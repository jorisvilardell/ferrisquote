CREATE TABLE estimator_variables (
  id UUID PRIMARY KEY,
  estimator_id UUID NOT NULL REFERENCES estimators(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  expression TEXT NOT NULL,
  description TEXT,
  rank VARCHAR(255) NOT NULL DEFAULT 'n',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_estimator_variables_estimator_id ON estimator_variables (estimator_id);
