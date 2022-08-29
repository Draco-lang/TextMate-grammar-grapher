#!/usr/bin/env node

const commander = require('commander');
const fs = require('fs');
const fetch = require('sync-fetch');

const yaml = require('js-yaml');
const cson = require('cson-parser');
const plist = require('plist');

// Program options
commander
    .name('graph-tmgrammar')
    .description('Graphs TextMate grammar interdependencies in different formats')
    .addArgument(new commander.Argument('<source>', 'the source path or URL for the TextMate grammar').argRequired())
    .option('-e, --exclude <names...>', 'a list of node names to exclude from the output', [])
    .option('-r, --regex', 'allows the output to include regexes')
    .option('-l, --label', 'enables labeling the arrows for annotating the relations')
    .action((sourcePath, options) => {
        // Load the source text
        let sourceCode = loadSource(sourcePath);
        // Parse the file
        let grammar = parseTextMateGrammar(sourceCode);
        // Write the graph
        writeGraph(grammar, options);
    });
commander.parse();

function loadSource(sourcePath) {
    try {
        if (isValidHttpUrl(sourcePath)) {
            return fetch(sourcePath).text();
        }
        else {
            return fs.readFileSync(sourcePath);
        }
    }
    catch (_) {
        commander.error(`Could not load source from path or url ${sourcePath}`, { exitCode: 1 });
    }
}

function parseTextMateGrammar(string) {
    try {
        return yaml.load(string);
    }
    catch (_) { }
    try {
        return cson.parse(string);
    }
    catch (_) { }
    try {
        return JSON.parse(string);
    }
    catch (_) { }
    try {
        return plist.parse(string);
    }
    catch (_) { }

    commander.error(`Could not recognize file format`, { exitCode: 1 });
}

function isValidHttpUrl(string) {
    try {
        let url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    }
    catch (_) {
        return false;
    }
}

function writeGraph(grammar, options) {
    let exclusionList = options.exclude;
    let includeRegexes = options.regex;
    let labelArrows = options.label;

    // Write the DOT header
    process.stdout.write('digraph TextMate {');

    // Go through the top-level patterns
    // We annotate top-level with $self
    grammar.patterns.forEach(pattern => {
        for (let { referenced, label, isRegex } of referencedPatterns(pattern, includeRegexes)) {
            if (isRegex && !includeRegexes) continue;
            if (exclusionList.includes(referenced)) continue;
            process.stdout.write(`  "$self" -> "${escapeString(referenced)}"`);
            if (labelArrows) process.stdout.write(` [label="${label}"]`);
            process.stdout.write(';\n');
        }
    });

    // Go through the repository
    if ('repository' in grammar) {
        for (let [patternName, pattern] of Object.entries(grammar.repository)) {
            if (exclusionList.includes(patternName)) continue;
            for (let { referenced, label, isRegex } of referencedPatterns(pattern, includeRegexes)) {
                if (isRegex && !includeRegexes) continue;
                if (exclusionList.includes(referenced)) continue;
                process.stdout.write(`  "${escapeString(patternName)}" -> "${escapeString(referenced)}"`);
                if (labelArrows) process.stdout.write(` [label="${label}"]`);
                process.stdout.write(';\n');
            }
        }
    }

    // Write the DOT footer
    process.stdout.write('}');
}

// Structure of reference is { referenced, label, isRegex }
function* referencedPatterns(pattern, includeRegex) {
    if ('include' in pattern) {
        if (pattern.include[0] == '#') {
            let name = pattern.include.substring(1);
            yield { referenced: name, label: 'include', isRegex: false };
        }
        else {
            yield { referenced: pattern.include, label: 'include', isRegex: false };
        }
    }
    if ('patterns' in pattern) {
        for (let referenced of pattern.patterns) {
            yield* referencedPatterns(referenced, includeRegex);
        }
    }

    if (includeRegex) {
        if ('match' in pattern) yield { referenced: pattern.match, label: 'match', isRegex: true };
        if ('begin' in pattern) yield { referenced: `begin: ${pattern.begin}\n\nend: ${pattern.end}`, label: 'surround', isRegex: true };
    }
}

function escapeString(string) {
    return string
        .replaceAll('\\', '\\\\')
        .replaceAll('"', '\\"');
}
