# TextMate grammar grapher

This is a tool to get a DOT graph output for the pattern interdependencies in a TextMate grammar file.

Usage:

```
node . path-or-url
```

You can also install it as a global tool with:

```
npm install -g .
```

Then, usage becomes:

```
graph-tmgrammar path-or-url
```

Optionally, you can provide a list of patterns to exclude from the result, using the `--exclude` flag:

```
graph-tmgrammar path-or-url --exclude foo bar baz
```

Supported formats:
 * YAML
 * JSON
 * CSON
 * plist
