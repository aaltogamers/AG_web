/* eslint-disable camelcase */

// Scheduled posts. See "Scheduled posts" in README.md.

exports.shorthands = undefined

exports.up = (pgm) => {
  // Review chat, approvers, Discord server, website settings and the renewed
  // Instagram token, one row per group
  pgm.createTable('social_settings', {
    key: { type: 'text', primaryKey: true },
    value: { type: 'jsonb', notNull: true, default: '{}' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('social_channels', {
    id: { type: 'bigserial', primaryKey: true },
    platform: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    // Telegram: { chatId, threadId }, Discord: { channelId, crosspost }, Instagram: {}
    config: { type: 'jsonb', notNull: true, default: '{}' },
    ref: { type: 'text', notNull: true, default: '' },
    default_footer_md: { type: 'text', notNull: true, default: '' },
    enabled: { type: 'boolean', notNull: true, default: true },
    // Channels that have posts are only disabled and hidden when deleted
    deleted_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('social_channels', ['platform', 'name'], {
    name: 'social_channels_platform_name_unique',
    unique: true,
    where: 'deleted_at IS NULL',
  })

  // Chats the posts bot has been added to or /register'ed in, for the settings dropdowns
  pgm.createTable('tg_known_chats', {
    chat_id: { type: 'text', notNull: true },
    // '' when not a topic
    thread_id: { type: 'text', notNull: true, default: '' },
    title: { type: 'text', notNull: true, default: '' },
    type: { type: 'text', notNull: true, default: '' },
    seen_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.addConstraint('tg_known_chats', 'tg_known_chats_pkey', {
    primaryKey: ['chat_id', 'thread_id'],
  })

  pgm.createTable('posts', {
    id: { type: 'bigserial', primaryKey: true },
    title: { type: 'text', notNull: true, default: '' },
    body_md: { type: 'text', notNull: true, default: '' },
    event_slug: { type: 'text' },
    // draft | awaiting_approval | scheduled | done | cancelled
    status: { type: 'text', notNull: true, default: 'draft' },
    // Goes up on every edit; only the approved version is ever sent
    version: { type: 'integer', notNull: true, default: 1 },
    approved_version: { type: 'integer' },
    approved_by: { type: 'text' },
    approved_at: { type: 'timestamptz' },
    // Default send time of the post's channels
    send_at: { type: 'timestamptz' },
    // admin | agent | tg:<user id>
    created_by: { type: 'text', notNull: true },
    updated_by: { type: 'text', notNull: true },
    // Set when the review topic has been told that the post wasn't approved in time
    missed_notice_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('posts', 'status', { name: 'posts_status_idx' })

  pgm.createTable('post_targets', {
    id: { type: 'bigserial', primaryKey: true },
    post_id: { type: 'bigint', notNull: true, references: 'posts', onDelete: 'CASCADE' },
    channel_id: { type: 'bigint', notNull: true, references: 'social_channels' },
    // Own send time of this channel; the post's send_at when null
    send_at: { type: 'timestamptz' },
    // A detached copy of the text for this channel
    body_override_md: { type: 'text' },
    footer_override_md: { type: 'text' },
    // pending | sending | sent | held | failed | cancelled
    status: { type: 'text', notNull: true, default: 'pending' },
    external_message_id: { type: 'text' },
    sent_at: { type: 'timestamptz' },
    error: { type: 'text' },
    attempts: { type: 'integer', notNull: true, default: 0 },
    next_attempt_at: { type: 'timestamptz' },
    position: { type: 'integer', notNull: true, default: 0 },
  })
  pgm.addConstraint('post_targets', 'post_targets_post_channel_unique', {
    unique: ['post_id', 'channel_id'],
  })
  pgm.createIndex('post_targets', 'status', { name: 'post_targets_status_idx' })

  pgm.createTable('post_website_changes', {
    post_id: { type: 'bigint', primaryKey: true, references: 'posts', onDelete: 'CASCADE' },
    // Earliest send time minus the default lead time when null
    run_at: { type: 'timestamptz' },
    // run_at, or the default worked out from the send times, fixed when the post is approved
    scheduled_run_at: { type: 'timestamptz' },
    // create_event | update_event
    kind: { type: 'text', notNull: true },
    // The existing event, or the slug a new event gets when the change runs
    event_slug: { type: 'text' },
    // The new event, or the fields to change
    event: { type: 'jsonb', notNull: true, default: '{}' },
    // [{ sessionId?, form }]
    signup_forms: { type: 'jsonb', notNull: true, default: '[]' },
    // Values of the changed fields at approval time, to detect conflicts
    base: { type: 'jsonb' },
    // pending | sending | done | failed | skipped | cancelled
    status: { type: 'text', notNull: true, default: 'pending' },
    commit_sha: { type: 'text' },
    // Set once the event file has been committed, so a retry only saves the forms
    event_saved_at: { type: 'timestamptz' },
    error: { type: 'text' },
    attempts: { type: 'integer', notNull: true, default: 0 },
    next_attempt_at: { type: 'timestamptz' },
    ran_at: { type: 'timestamptz' },
  })

  // Uploaded images, converted to JPEG so Instagram accepts them
  pgm.createTable('post_media', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    data: { type: 'bytea', notNull: true },
    content_type: { type: 'text', notNull: true },
    width: { type: 'integer', notNull: true },
    height: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('post_images', {
    id: { type: 'bigserial', primaryKey: true },
    post_id: { type: 'bigint', notNull: true, references: 'posts', onDelete: 'CASCADE' },
    position: { type: 'integer', notNull: true },
    // Either an uploaded image or an existing site image (a path under public/)
    media_id: { type: 'uuid', references: 'post_media' },
    site_path: { type: 'text' },
  })
  pgm.createIndex('post_images', 'post_id', { name: 'post_images_post_id_idx' })

  pgm.createTable('post_events', {
    id: { type: 'bigserial', primaryKey: true },
    post_id: { type: 'bigint', notNull: true, references: 'posts', onDelete: 'CASCADE' },
    version: { type: 'integer', notNull: true },
    action: { type: 'text', notNull: true },
    actor: { type: 'text', notNull: true },
    comment: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('post_events', 'post_id', { name: 'post_events_post_id_idx' })

  // Messages the posts bot has sent to the review topic, so they can be edited
  // after a button press
  pgm.createTable('tg_preview_messages', {
    id: { type: 'bigserial', primaryKey: true },
    post_id: { type: 'bigint', notNull: true, references: 'posts', onDelete: 'CASCADE' },
    version: { type: 'integer', notNull: true },
    chat_id: { type: 'text', notNull: true },
    message_id: { type: 'bigint', notNull: true },
    // summary | notice | reason_prompt
    kind: { type: 'text', notNull: true },
    // Text of the message, to edit it after a button press
    text: { type: 'text', notNull: true, default: '' },
    // Telegram user who pressed reject, for the reason prompt
    actor: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createIndex('tg_preview_messages', 'post_id', { name: 'tg_preview_messages_post_id_idx' })
  pgm.createIndex('tg_preview_messages', ['chat_id', 'message_id'], {
    name: 'tg_preview_messages_chat_message_idx',
  })
}

exports.down = (pgm) => {
  pgm.dropTable('tg_preview_messages')
  pgm.dropTable('post_events')
  pgm.dropTable('post_images')
  pgm.dropTable('post_media')
  pgm.dropTable('post_website_changes')
  pgm.dropTable('post_targets')
  pgm.dropTable('posts')
  pgm.dropTable('tg_known_chats')
  pgm.dropTable('social_channels')
  pgm.dropTable('social_settings')
}
