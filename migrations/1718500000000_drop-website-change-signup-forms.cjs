/* eslint-disable camelcase */

// Website changes of posts no longer make sign-up forms: they are edited on the
// sign-ups page

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.dropColumn('post_website_changes', 'signup_forms')
}

exports.down = (pgm) => {
  pgm.addColumn('post_website_changes', {
    signup_forms: { type: 'jsonb', notNull: true, default: '[]' },
  })
}
