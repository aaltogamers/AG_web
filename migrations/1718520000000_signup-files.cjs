/* eslint-disable camelcase */

// Images uploaded with a sign-up (e.g. a team logo), re-encoded to WebP. Also
// moves the description of text fields to the new placeholder, since descriptions
// are now shown as help text under the title.

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('signup_files', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    signup_id: { type: 'bigint', notNull: true, references: 'signups', onDelete: 'CASCADE' },
    data: { type: 'bytea', notNull: true },
    content_type: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('signup_files', 'signup_id')

  pgm.sql(`
    UPDATE signup_events SET inputs = (
      SELECT COALESCE(jsonb_agg(
        CASE WHEN elem->>'type' = 'text' AND COALESCE(elem->>'description', '') <> ''
          THEN (elem - 'description') || jsonb_build_object('placeholder', elem->'description')
          ELSE elem END
        ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(inputs) WITH ORDINALITY AS t(elem, ord)
    )
    WHERE jsonb_typeof(inputs) = 'array'
  `)
}

exports.down = (pgm) => {
  pgm.dropTable('signup_files')
}
