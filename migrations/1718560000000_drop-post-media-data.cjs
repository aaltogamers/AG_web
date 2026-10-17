/* eslint-disable camelcase */

// All uploaded post images have been moved to Blob Storage (src/utils/mediaStore.ts).
// Kept if any still has its data, so that no image is lost.

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM post_media WHERE data IS NOT NULL) THEN
        ALTER TABLE post_media DROP COLUMN data;
      END IF;
    END $$
  `)
}

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE post_media ADD COLUMN IF NOT EXISTS data bytea')
}
