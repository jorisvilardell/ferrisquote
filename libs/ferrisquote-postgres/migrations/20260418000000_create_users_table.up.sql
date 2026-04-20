CREATE TABLE users (
  id UUID PRIMARY KEY,
  mail VARCHAR(320) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_mail_unique UNIQUE (mail)
);

CREATE INDEX idx_users_mail ON users (mail);
