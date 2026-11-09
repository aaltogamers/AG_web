/* eslint-disable camelcase */

// Links with a statistics tag (?ref=), made on the "Links and QR codes" admin page

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('tagged_links', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    url: { type: 'text', notNull: true },
    tag: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.addConstraint('tagged_links', 'tagged_links_url_tag_unique', { unique: ['url', 'tag'] })
}

exports.down = (pgm) => {
  pgm.dropTable('tagged_links')
}
