
import {exec} from 'child_process';
import {createReadStream} from 'fs';
import {createInterface} from 'readline';
import * as chalk from 'chalk';

import * as fs from 'fs';
import * as path from 'path';

const color = new chalk.Instance({level: 2});
const mm = require('micromatch');

const debug_mode = false;

function debug(...vars: any[]) {
  if (debug_mode) {
    console.log('[DEBUG]', ...vars);
  }
}

function printConfig(config: IConfigPreCommit) {
  console.log(color.magentaBright('bad_words:'));
  Object.keys(config.bad_words).forEach((group) => {
    const words = config.bad_words[group];
    console.log(color.blue(`  ${group}:`), words.join(', '));
  })
}

export async function pre_commit() {
  const curr_dir = process.cwd();
  const dir_git = searchDirTop(curr_dir, '.git');

  debug('dir_git', dir_git);

  if (dir_git === null) {
    console.warn(`Git-repository top of "${curr_dir}" not found.`)
    process.exit(1);
  }

  const config: IConfigPreCommit = getSearchSettings(dir_git);
  debug('config', config);

  const commit_files = await getFileList();

  for (const group of Object.keys(config.bad_words)) {
    debug('group:', group);
    const words = config.bad_words[group];
    const file_pattern = config.patterns[group];

    const files = mm(commit_files, file_pattern);

    const result = await searchStringInFiles(group, words, files);

    if (result.length > 0) {
      process.exitCode = 1;

      printConfig(config);
      console.log(color.magentaBright('found:'));
      result.forEach((res: ISearchResultFile) => {

        res.result.forEach((line) => {
          let output = formatOutput(line, config)
          console.log(' ', res.file, output);
        })
      })

    }

  }
  if(process.exitCode !==1){
    console.log(color.greenBright('[success]'),' Bad words not found.');
  }
}


function searchDirTop(start: string, dir: string, stop = '/') {

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


function getSearchSettings(dir_git): IConfigPreCommit {
  debug('dir_git', dir_git);
  const path_config = path.join(dir_git, 'hooks/config/pre-commit.json');
  console.log(color.cyan('[git]:' + dir_git));
  return require(path_config);
}

function formatOutput(data: ISearchResultLine, config: IConfigPreCommit) {
  const {group, row, source} = data;
  const words=config.bad_words[group];
  const output = words.reduce((acc, m) => {
    acc=acc.replace(m, color.red(m));
    return acc;
  }, source);
  return `[str: ${row}] ${output}`;
}

function searchStringInFile(group: string,file: string, patterns: string[]): Promise<ISearchResultLine[]> {
  debug('file:',file,'group:',group);
  const result: ISearchResultLine[] = [];
  let row = 0;

  const rl = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity
  });

  return new Promise((resolve, reject) => {
    rl.on('line', (source: string) => {
      const match = mm([source], patterns, {capture: true, contains: true});
      if (match.length > 0) {
        result.push({group, row, match, source});
      }
      row++;
    });

    rl.on('close', (line: string) => {
      resolve(result);
    });
  })
}

async function searchStringInFiles(group: string, patterns: string[], files: string[]): Promise<ISearchResultFile[]> {
  const search_result: ISearchResultFile[] = [];

  for (const file of files) {
    try {
      const result: ISearchResultLine[] = await searchStringInFile(group, file, patterns);
      if (result.length > 0) {
        search_result.push({file, result})
      }
    } catch (err) {
      console.error(err);
    }
  }
  return search_result;
};


function getFileList(): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    exec('git diff --cached --name-only', (error, stdout, stderr) => {
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
