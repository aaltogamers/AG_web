/* eslint-disable camelcase */

// Uploaded post images move to Blob Storage (src/utils/mediaStore.ts). `data`
// stays for the images not yet moved by scripts/movePostMedia.ts, and is dropped
// once they all are.

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.alterColumn('post_media', 'data', { notNull: false })
}

exports.down = () => {}
