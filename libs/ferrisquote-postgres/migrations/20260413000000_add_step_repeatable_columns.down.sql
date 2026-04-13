ALTER TABLE steps
  DROP COLUMN is_repeatable,
  DROP COLUMN repeat_label,
  DROP COLUMN min_repeats,
  DROP COLUMN max_repeats;
