#!/usr/bin/env node

const commander = require('commander');
const fs = require('fs');
const fetch = require('sync-fetch');

const yaml = require('js-yaml');
const cson = require('cson-parser');
const plist = require('plist');

var surroundCount = 0;

// Program options
commander
    .name('graph-tmgrammar')
    .description('Graphs TextMate grammar interdependencies in different formats')
    .addArgument(new commander.Argument('<source>', 'the source path or URL for the TextMate grammar').argRequired())
    .option('-e, --exclude <names...>', 'a list of node names to exclude from the output', [])
    .option('-r, --regex', 'allows the output to include regexes')
    .option('-l, --label', 'enables labeling the arrows for annotating the relations')
    .option('-u, --uncomment', 'uncomments all regexes')
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
    let uncommentRx = options.uncomment;

    function writePattern(patternName, pattern) {
        patternName = escapeString(patternName);
        if (exclusionList.includes(patternName)) return;
        for (let { referenced, label, isRegex, children } of referencedPatterns(pattern, includeRegexes)) {
            if (isRegex && !includeRegexes) continue;
            if (exclusionList.includes(referenced)) continue;
            referenced = escapeString(referenced);
            if (isRegex && uncommentRx) referenced = uncommentRegex(referenced);
            process.stdout.write(`  "${patternName}" -> "${referenced}"`);
            if (labelArrows) process.stdout.write(` [label="${label}"]`);
            process.stdout.write(';\n');

            if (children) {
                process.stdout.write(`  "${referenced}" [label=""];\n`);
                for (let child of children) {
                    let subReferenced = child.referenced;
                    subReferenced = escapeString(subReferenced);
                    if (uncommentRx) subReferenced = uncommentRegex(subReferenced);
                    process.stdout.write(`  "${referenced}" -> "${subReferenced}"`);
                    if (labelArrows) process.stdout.write(` [label="${child.label}"]`);
                    process.stdout.write(';\n');
                }
            }
        }
    }

    // Write the DOT header
    process.stdout.write('digraph TextMate {');

    // We annotate top-level with $self
    grammar.patterns.forEach(pattern => writePattern('$self', pattern));

    // Go through the repository
    if ('repository' in grammar) {
        for (let [patternName, pattern] of Object.entries(grammar.repository)) {
            writePattern(patternName, pattern);
        }
    }

    // Write the DOT footer
    process.stdout.write('}');
}

// Structure of reference is { referenced, label, isRegex, children }
function* referencedPatterns(pattern, includeRegex) {
    if ('include' in pattern) {
        if (pattern.include[0] == '#') {
            let name = pattern.include.substring(1);
            yield { referenced: name, label: 'include', isRegex: false, children: null };
        }
        else {
            yield { referenced: pattern.include, label: 'include', isRegex: false, children: null };
        }
    }
    if ('patterns' in pattern) {
        for (let referenced of pattern.patterns) {
            yield* referencedPatterns(referenced, includeRegex);
        }
    }

    if (includeRegex) {
        if ('match' in pattern) yield { referenced: pattern.match, label: 'match', isRegex: true, children: null };
        if ('begin' in pattern) yield {
            referenced: `__surround${surroundCount++}`,
            label: 'surround',
            isRegex: true,
            children: [{ referenced: pattern.begin, label: 'begin' }, { referenced: pattern.end, label: 'end' }],
        };
    }
}

function escapeString(string) {
    return string
        .replaceAll('\\', '\\\\')
        .replaceAll('"', '\\"');
}

function uncommentRegex(string) {
    return string
        .replace(/ *#.*/g, '');
}
