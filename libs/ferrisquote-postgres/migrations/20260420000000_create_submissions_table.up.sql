CREATE TABLE submissions (
  id UUID PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answers JSONB NOT NULL
);

CREATE INDEX idx_submissions_flow_id ON submissions (flow_id);
CREATE INDEX idx_submissions_user_id ON submissions (user_id);
CREATE INDEX idx_submissions_submitted_at ON submissions (submitted_at DESC);
