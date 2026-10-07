With {{OVER_NAME}}
------------------
If your game already has naudh1r's {{OVER_NAME}} {{OVER_VERSION}}, the same
Install.cmd notices, and adds Continuing Semesters on top of it. Both mods
then work together. Install {{OVER_NAME}} first, with its own setup.

Two mods can't simply be stacked, because both change the same few code
files. So for this case the download holds no code files, only differences
(payload/over/): what has to change in the files {{OVER_NAME}} installed so
that they hold both mods. None of {{OVER_NAME}}'s own code is in this zip.

- It has to be exactly {{OVER_NAME}} {{OVER_VERSION}}. A newer or older one is
  refused: wait for a Continuing Semesters made for it.
- Uninstall.cmd puts the game back to {{OVER_NAME}} alone.
- Take the mods out in the reverse order you put them in: this one first,
  then {{OVER_NAME}} with its own uninstall. The same goes for updating
  {{OVER_NAME}}.
- If {{OVER_NAME}} was uninstalled or updated first, Continuing Semesters
  is already gone from the game with it. Run Uninstall.cmd here once
  anyway: it notices, and only clears its own leftover backup.

The source both mods are merged in, which the differences are made from,
is the semester-0.3-photo branch of the repository below.

