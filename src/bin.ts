#!/usr/bin/env node
/* eslint-disable node/no-unpublished-bin */

import { cosmiconfigSync } from 'cosmiconfig';
import type { Opts } from 'minimist';
// import createDebug from 'debug';
import type { Arguments, CosmiconfigResut, Config } from './config';
import { normalizeConfig } from './config';
import { subarg } from './subarg';
import { cloneRepositories } from './clone';
import {
  collectWorkspaces,
  createRootManifest,
  alignWorkspaceVersions,
} from './workspaces';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { yarn } from './yarn';

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
  yarn(config);
  // execute commands in repositories
} catch (err) {
  process.exitCode = 1;
  console.error(err);
  // display help
}
