#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pre_commit = void 0;
const tslib_1 = require("tslib");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const readline_1 = require("readline");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const color = new chalk.Instance({ level: 2 });
const mm = require('micromatch');
const debug_mode = false;
function debug(...vars) {
    if (debug_mode) {
        console.log('[DEBUG]', ...vars);
    }
}
function printConfig(config) {
    console.log(color.magentaBright('bad_words:'));
    Object.keys(config.bad_words).forEach((group) => {
        const words = config.bad_words[group];
        console.log(color.blue(`  ${group}:`), words.join(', '));
    });
}
function pre_commit() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const curr_dir = process.cwd();
        const dir_git = searchDirTop(curr_dir, '.git');
        debug('dir_git', dir_git);
        if (dir_git === null) {
            console.warn(`Git-repository top of "${curr_dir}" not found.`);
            process.exit(1);
        }
        const config = getSearchSettings(dir_git);
        debug('config', config);
        const commit_files = yield getFileList();
        for (const group of Object.keys(config.bad_words)) {
            debug('group:', group);
            const words = config.bad_words[group];
            const file_pattern = config.patterns[group];
            const files = mm(commit_files, file_pattern);
            const result = yield searchStringInFiles(group, words, files);
            if (result.length > 0) {
                process.exitCode = 1;
                printConfig(config);
                console.log(color.magentaBright('found:'));
                result.forEach((res) => {
                    res.result.forEach((line) => {
                        let output = formatOutput(line, config);
                        console.log(' ', res.file, output);
                    });
                });
            }
        }
        if (process.exitCode !== 1) {
            console.log(color.greenBright('[success]'), ' Bad words not found');
        }
    });
}
exports.pre_commit = pre_commit;
function searchDirTop(start, dir, stop = '/') {
    const files = fs.readdirSync(start);
    if (files.includes(dir)) {
        return path.join(start, dir);
    }
    const parent = path.dirname(start);
    if (parent === stop) {
        return null;
    }
    return searchDirTop(parent, dir);
}
function getSearchSettings(dir_git) {
    debug('dir_git', dir_git);
    const path_config = path.join(dir_git, 'hooks/config/pre-commit.json');
    console.log(color.cyan('[git]:' + dir_git));
    return require(path_config);
}
function formatOutput(data, config) {
    const { group, row, source } = data;
    const words = config.bad_words[group];
    const output = words.reduce((acc, m) => {
        acc = acc.replace(m, color.red(m));
        return acc;
    }, source);
    return `[str: ${row}] ${output}`;
}
function searchStringInFile(group, file, patterns) {
    debug('file:', file, 'group:', group);
    const result = [];
    let row = 0;
    const rl = readline_1.createInterface({
        input: fs_1.createReadStream(file),
        crlfDelay: Infinity
    });
    return new Promise((resolve, reject) => {
        rl.on('line', (source) => {
            const match = mm([source], patterns, { capture: true, contains: true });
            if (match.length > 0) {
                result.push({ group, row, match, source });
            }
            row++;
        });
        rl.on('close', (line) => {
            resolve(result);
        });
    });
}
function searchStringInFiles(group, patterns, files) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const search_result = [];
        for (const file of files) {
            try {
                const result = yield searchStringInFile(group, file, patterns);
                if (result.length > 0) {
                    search_result.push({ file, result });
                }
            }
            catch (err) {
                console.error(err);
            }
        }
        return search_result;
    });
}
;
function getFileList() {
    return new Promise((resolve, reject) => {
        child_process_1.exec('git diff --cached --name-only', (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                reject();
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                reject();
                return;
            }
            resolve(stdout.split('\n').filter((fileName) => !!fileName));
        });
    });
}
//# sourceMappingURL=pre-commit.command.js.map