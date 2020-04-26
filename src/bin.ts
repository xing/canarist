#!/usr/bin/env node
/* eslint-disable node/no-unpublished-bin */

import { cosmiconfigSync } from 'cosmiconfig';
import type { Opts } from 'minimist';
// import createDebug from 'debug';
import type { Arguments, CosmiconfigResut, Config } from './config';
import { normalizeConfig } from './config';
import { subarg } from './subarg';
import { cloneRepositories } from './clone';

// const debug = createDebug('canarist');

const minimistConfig: Opts = {
  alias: {
    help: ['h'],
    repository: ['r'],
    branch: ['b'],
    command: ['c'],
    directory: ['d'],
    'root-manifest': ['m'],
    'yarn-arguments': ['y'],
    project: ['p'],
  },
  boolean: ['help'],
  string: [
    'repository',
    'branch',
    'command',
    'directory',
    'root-manifest',
    'yarn-arguments',
    'project',
  ],
};

function invokeCLI(argv: string[]): Config {
  const args: Arguments = subarg(argv, minimistConfig);
  const config: null | CosmiconfigResut = cosmiconfigSync('canarist').search();

  if (args.help) {
    throw new Error('Usage:');
  }

  return normalizeConfig(args, config);
}

try {
  // check if git and yarn are in the PATH
  const config = invokeCLI(process.argv.slice(2));
  cloneRepositories(config);
  console.log(config);
  // create root manifest
  // merge workspaces in root manifest
  // align workspace versions
  // install dependencies
  // execute commands in repositories
} catch (err) {
  process.exitCode = 1;
  console.error(err);
  // display help
}
