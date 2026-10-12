/* eslint-disable camelcase */

// The post as it was after each save, so the editor can go back to an earlier version

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('post_events', { snapshot: { type: 'jsonb' } })
}

exports.down = (pgm) => {
  pgm.dropColumn('post_events', 'snapshot')
}
