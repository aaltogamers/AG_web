/* eslint-disable camelcase */

// Responsible people of a post and its image, reminded before the post goes out,
// and the post's event's image as a post image

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('posts', {
    // { id, name } of a Telegram user
    responsible: { type: 'jsonb' },
    should_have_image: { type: 'boolean', notNull: true, default: false },
    image_responsible: { type: 'jsonb' },
    // When the responsible people were last reminded (social/reminders.ts)
    reminded_at: { type: 'timestamptz' },
  })
  pgm.addColumn('post_images', {
    // The post's event's image when the post is sent
    event_image: { type: 'boolean', notNull: true, default: false },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('post_images', 'event_image')
  pgm.dropColumn('posts', ['responsible', 'should_have_image', 'image_responsible', 'reminded_at'])
}
