# Habits integration

Ported from [JamesCliffordSpratt/obsidian-habits](https://github.com/JamesCliffordSpratt/obsidian-habits), version 1.12.1, commit `38c44bc4d329455701045ca0858109b5a1708c56`.

Copyright (c) 2025 James Clifford Spratt. The vendored implementation is MIT licensed; see LICENSE in this directory. Task Genius's existing license is unchanged. The MIT notice is also included in distributed JavaScript.

Task Genius changes: host settings adapter, namespaced views/commands/code blocks, embedded dashboard/settings, scoped theme styling, legacy-record compatibility, configurable data location, optional completion-based intervals, and integration regression tests. No source from zm4341/taskgenius-plugin is used.

`upstream.css` is preserved as input; regenerate `scoped.css` with `node scripts/scope-habits-css.mjs` when changing upstream styling.
