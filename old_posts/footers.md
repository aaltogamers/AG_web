# Default footers

The footer is added after the post body, with an empty line between them. The `{{link:…}}` placeholders get the channel's `?ref=` automatically.

## Telegram (AG channel)

```md
Follow & join Aalto Gamers!
🔹 [Discord]({{link:discord}})
🔹 [Instagram]({{link:instagram}})
```

Optional extra line for newcomers: `🗓 [All events]({{link:calendar}})`

## Telegram (other groups' channels)

```md
Follow & join Aalto Gamers!
🔹 [Telegram]({{link:telegram}})
🔹 [Discord]({{link:discord}})
🔹 [Instagram]({{link:instagram}})
```

## Discord

No footer. If you want one anyway:

```md
🔹 [Telegram]({{link:telegram}}) · [Instagram]({{link:instagram}})
```

## Instagram

Links can't be clicked on Instagram, so don't put any URL in it:

```
💬 Join our Discord & Telegram – link in bio!
```

If the channel has the "link in bio" option on, use `💬 Join our Discord & Telegram!` instead, because posts with links already get `🔗 Link in bio` added at the end.

## Ways this improves on the old posts

- **Correct tracking:** placeholders replace the hardcoded `?ref=website` and the mix of `t.me`, `discord.gg` and `aaltogamers.fi/link` URLs.
- **The same footer every time:** before, whether a post had one was random.
- **Short labels:** "Discord" instead of "Aalto Gamers Discord".
- **Keep the sign-off in the body:** "See you there, gamers! 🎮✨" depends on the post, so it shouldn't be part of the footer.
