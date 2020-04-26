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

function printUsage(): void {
  console.log(
    'Usage: canarist options [<target>]',
    '\n\nOptions:',
    '\n    --repository, -r',
    '\n        The URL (or local file path) to a repository to clone.',
    '\n        This option accepts sub-arguments (see examples):',
    '\n            --branch, -b',
    '\n                The branch that should be checked out (default: master).',
    '\n            --command, -c',
    '\n                The command to execute in this repository (default: "yarn test").',
    '\n            --directory, -d',
    '\n                This option allows to change the directory name in case of conflicts.',
    '\n    --root-manifest, -m',
    '\n        A valid JSON string that should be merged into the generated root manifest.',
    '\n    --yarn-arguments, -y',
    '\n        Additional arguments that should be passed to the "yarn install" command.',
    '\n    --project, -p',
    '\n        The name of a project to execute in a multi-project configuration.',
    '\n\nExamples:',
    '\n    $ canarist -r git@github.com:xing/canarist.git -r git@github.com:some/other.git',
    '\n        Clones xing/canarist and some/other into a temporary directory',
    '\n        and executes "yarn test" in both repositories.',
    '\n\n    $ canarist -r [git@github.com:xing/canarist.git -b next -c] -r git@github.com:some/other.git',
    '\n        Clones the "next" branch of xing/canarist and the master branch of some/other',
    '\n        and executes no command in xing/canarist and "yarn test" in some/other.',
    '\n\n    $ canarist -r [git@github.com:xing/canarist.git -d canarist] -r [git@github.com:my/canarist.git -d my-canarist]',
    '\n        Clones xing/canarist into canarist and my/canarist into my-canarist inside a temporary directory.',
    '\n\n    $ canarist -r ~/work/canarist -r ~/work/other -m \'{"resolutions":{"typescript":"3.2.4"},"devDependencies":{"jest":"23.0.0}}\'',
    '\n        Clones the master branches of both local repositories into a temporary directory',
    '\n        and additionally installs yarn resolutions and a missing dev dependency.',
    '\n\n    $ canarist -r ~/work/canarist -r ~/work/other -r ~/work/other2 -r ~/work/other3',
    '\n        Clones the master branches of all four local repositories into a temporary directory',
    '\n        and executes "yarn test" for each of them.',
    '\n\n    $ canarist -r ~/work/canarist -r ~/work/other --y "--production=true"',
    '\n        Clones the master branches of both repositories and installs production dependencies only',
    '\n\n    $ canarist -p my-project',
    '\n        Looks up the project configuration with the name "my-project" in the cosmiconfig',
    '\n        of the current repository and clones and executes the repositories and commands therein.',
    '\n        Read more: https://github.com/xing/canarist/blob/master/README.md',
    '\n'
  );
}

function invokeCLI(argv: string[]): Config {
  const args: Arguments = subarg(argv, minimistConfig);
  const config: null | CosmiconfigResut = cosmiconfigSync('canarist').search();

  // todo: how about a --no-install or --no-commands flag to enable quick debugging?

  if (args.help) {
    printUsage();
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }

  try {
    return normalizeConfig(args, config);
  } catch (error) {
    console.error(error);
    printUsage();
    // eslint-disable-next-line no-process-exit
    process.exit(1);
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
