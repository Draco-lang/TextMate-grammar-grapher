# TextMate grammar grapher

This is a tool to get a DOT graph output for the pattern interdependencies in a TextMate grammar file.

Usage: `graph-tmgrammar [options] <source>`

Arguments:
  * source: The source path or URL for the TextMate grammar

Options:
  * `-e, --exclude <names...>`: A list of node names to exclude from the output
  * `-r, --regex`: Allows the output to include regexes
  * `-l, --label`: Enables labeling the arrows for annotating the relations
  * `-h, --help`: Display help for command

Supported formats:
 * YAML
 * JSON
 * CSON
 * plist
