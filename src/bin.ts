#!/usr/bin/env node
/* eslint-disable node/no-unpublished-bin */

import { join } from 'path';
import { writeFileSync, existsSync, appendFileSync, readFileSync } from 'fs';
import { cosmiconfigSync } from 'cosmiconfig';
import type { Opts } from 'minimist';
import createDebug from 'debug';
import type { Arguments, CosmiconfigResut, Config } from './config';
import { normalizeConfig } from './config';
import { subarg } from './subarg';
import { cloneRepositories, yarn, executeCommands, execute } from './commands';
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

  // todo: how about a --no-install flag
  // todo: how about a --no-commands flag

  if (args.help) {
    console.log('usage:...'); // todo: log cli help
    throw new Error('done');
  }

  try {
    return normalizeConfig(args, config);
  } catch (error) {
    console.error(error);
    console.log('usage:...'); // todo: log cli help
    throw new Error('done');
  }
}

try {
  if (!execute('yarn -v', process.cwd())) {
    throw new Error('Yarn binary not found.');
  }
  if (!execute('git --version', process.cwd())) {
    throw new Error('Git binary not found.');
  }

  const config = invokeCLI(process.argv.slice(2));

  cloneRepositories(config, process.cwd(), debug);

  const workspacesConfig = collectWorkspaces(config);

  const manifests = [
    {
      path: join(config.targetDirectory, 'package.json'),
      manifest: createRootManifest(workspacesConfig),
    },
    ...alignWorkspaceVersions(workspacesConfig),
  ];

  // todo: allow to change pinned versions to semver ranges

  manifests.forEach(({ path, manifest }) => {
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  });

  // todo: allow to configure which files should be merged?
  config.repositories.forEach((repo) => {
    const npmrcPath = join(config.targetDirectory, repo.directory, '.npmrc');

    if (existsSync(npmrcPath)) {
      appendFileSync(
        join(config.targetDirectory, '.npmrc'),
        readFileSync(npmrcPath) + '\n'
      );
    }
  });

  yarn(config, debug);

  executeCommands(config, debug);

  console.log('[canarist] finished successfully!');
} catch (err) {
  process.exitCode = 1;
  console.error('[canarist] exited with error "%s"', err.message);
}
