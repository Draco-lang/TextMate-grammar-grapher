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
    .addArgument(new commander.Argument('<source>', 'The source path or URL for the TextMate grammar').argRequired())
    .option('-e, --exclude <names...>', 'A list of node names to exclude from the output', [])
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

    // Write the DOT header
    console.log('digraph TextMate {');

    // Go through the top-level patterns
    // We annotate top-level with $self
    grammar.patterns.forEach(pattern => {
        for (let referenced of referencedPatterns(pattern)) {
            if (exclusionList.includes(referenced)) continue;
            console.log(`  "$self" -> "${referenced}";`);
        }
    });

    // Go through the repository
    if ('repository' in grammar) {
        for (let [patternName, pattern] of Object.entries(grammar.repository)) {
            if (exclusionList.includes(patternName)) continue;
            for (let referenced of referencedPatterns(pattern)) {
                if (exclusionList.includes(referenced)) continue;
                console.log(`  "${patternName}" -> "${referenced}";`);
            }
        }
    }

    // Write the DOT footer
    console.log('}');
}

function* referencedPatterns(pattern) {
    if ('include' in pattern) {
        if (pattern.include[0] == '#') {
            yield pattern.include.substring(1);
        }
        else {
            yield pattern.include;
        }
    }
    else if ('patterns' in pattern) {
        for (let referenced of pattern.patterns) {
            yield* referencedPatterns(referenced);
        }
    }
}
