#!/usr/bin/env node
/* eslint-disable node/no-unpublished-bin */

import { join } from 'path';
import { writeFileSync } from 'fs';
import { cosmiconfigSync } from 'cosmiconfig';
import type { Opts } from 'minimist';
import createDebug from 'debug';
import type { Arguments, CosmiconfigResut, Config } from './config';
import { normalizeConfig } from './config';
import { subarg } from './subarg';
import { cloneRepositories, yarn, executeCommands } from './commands';
import {
  collectWorkspaces,
  createRootManifest,
  alignWorkspaceVersions,
} from './workspaces';

const isDebug = process.env.DEBUG && process.env.DEBUG.includes('canarist');
const debug = isDebug ? createDebug('canarist') : undefined;

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

  cloneRepositories(config, debug);

  const workspacesConfig = collectWorkspaces(config);

  const manifests = [
    {
      path: join(config.targetDirectory, 'package.json'),
      manifest: createRootManifest(workspacesConfig),
    },
    ...alignWorkspaceVersions(workspacesConfig),
  ];

  manifests.forEach(({ path, manifest }) => {
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  });

  yarn(config, debug);

  executeCommands(config, debug);
} catch (err) {
  process.exitCode = 1;
  console.error(err);
  // display help
}
