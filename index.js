#!/usr/bin/env node

const fs = require('fs');
const fetch = require('sync-fetch');

const yaml = require('js-yaml');
const cson = require('cson-parser');
const plist = require('plist');

// First, get the command-line arg
if (process.argv.length < 3) {
    console.error(`usage: ${process.argv[0]} ${process.argv[1]} <path or url>`);
    process.exit(1);
}
let sourcePath = process.argv[2];

let sourceCode;
// Load it, depending on if it's an URL or file path
if (isValidHttpUrl(sourcePath)) {
    sourceCode = fetch(sourcePath).text();
}
else {
    sourceCode = fs.readFileSync(sourcePath);
}

// Parse the file
let grammar = parseTextMateGrammar(sourceCode);

// Write the DOT header
console.log('digraph TextMate {');

// Go through the top-level patterns
// We annotate top-level with $self
grammar.patterns.forEach(pattern => {
    for (let referenced of referencedPatterns(pattern)) {
        console.log(`  "$self" -> "${referenced}";`);
    }
});

// Go through the repository
if ('repository' in grammar) {
    for (let [patternName, pattern] of Object.entries(grammar.repository)) {
        for (let referenced of referencedPatterns(pattern)) {
            console.log(`  "${patternName}" -> "${referenced}";`);
        }
    }
}

// Write the DOT footer
console.log('}');

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

function isValidHttpUrl(string) {
    try {
        let url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    }
    catch (_) {
        return false;
    }
}

function parseTextMateGrammar(string) {
    try {
        return yaml.load(string);
    }
    catch (_) {}
    try {
        return cson.parse(string);
    }
    catch (_) {}
    try {
        JSON.parse(string);
    }
    catch (_) {}
    try {
        return plist.parse(string);
    }
    catch (_) {}

    throw 'Unrecognizable file format!';
}
