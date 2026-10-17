/* eslint-disable camelcase */

// Events, moved here from src/content/events (scripts/importEvents.ts). `data` is
// the frontmatter of the old files. src/utils/eventStore.ts validates it; the
// CHECKs are a backstop.

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('events', {
    slug: { type: 'text', primaryKey: true },
    data: { type: 'jsonb', notNull: true },
    // Long description
    body: { type: 'text', notNull: true },
    // Increased on every save, to refuse saving over someone else's changes
    version: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.addConstraint('events', 'events_data_valid', {
    check: `jsonb_typeof(data->'name') = 'string' AND btrim(data->>'name') <> ''
      AND data->>'signupMode' IN ('none', 'event', 'session')
      AND jsonb_typeof(data->'sessions') = 'array'
      AND COALESCE(jsonb_typeof(data->'recordings'), 'array') = 'array'
      AND jsonb_typeof(data->'visibleOnCalendar') = 'boolean'
      AND jsonb_typeof(data->'visibleOnEventsPage') = 'boolean'`,
  })

  // Every save and delete, to undo a bad edit by hand
  pgm.createTable('event_revisions', {
    id: { type: 'bigserial', primaryKey: true },
    slug: { type: 'text', notNull: true },
    // null when the event was deleted
    data: { type: 'jsonb' },
    body: { type: 'text' },
    version: { type: 'integer', notNull: true },
    // 'admin', 'AI agent', 'post #12 v3' or 'import'
    author: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('event_revisions', ['slug', 'id'])
}

exports.down = (pgm) => {
  pgm.dropTable('event_revisions')
  pgm.dropTable('events')
}
