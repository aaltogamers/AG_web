/* eslint-disable camelcase */

// Existing unapproved posts count as already asked, so old drafts aren't all sent for approval at deploy

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.sql(`UPDATE posts SET approval_requested_at = COALESCE(approval_requested_at, now()),
    image_reminded_at = COALESCE(image_reminded_at, now())
    WHERE status IN ('draft', 'awaiting_approval')`)
}

exports.down = () => {}
