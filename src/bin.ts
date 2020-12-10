#!/usr/bin/env node
/* eslint-disable node/no-unpublished-bin */

import { join } from 'path';
import { writeFileSync, existsSync, appendFileSync, readFileSync } from 'fs';
import { cosmiconfigSync } from 'cosmiconfig';
import type { Opts } from 'minimist';
import createDebug from 'debug';
import type { Arguments, CosmiconfigResult, Config } from './config';
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
  console.log(`
Usage: canarist options [<target>]

Options:
    --repository, -r
        The URL (or local file path) to a repository to clone.
        This option accepts sub-arguments (see examples):
            --branch, -b
                The branch that should be checked out (default: master).
            --command, -c
                The command to execute in this repository (default: "yarn test").
            --directory, -d
                This option allows to change the directory name in case of conflicts.
    --root-manifest, -m
        A valid JSON string that should be merged into the generated root manifest.
    --yarn-arguments, -y
        Additional arguments that should be passed to the "yarn install" command.
    --project, -p
        The name of a project to execute in a multi-project configuration.

Examples:
    $ canarist -r git@github.com:xing/canarist.git -r git@github.com:some/other.git
        Clones xing/canarist and some/other into a temporary directory
        and executes "yarn test" in both repositories.

    $ canarist -r [git@github.com:xing/canarist.git -b next -c] -r git@github.com:some/other.git
        Clones the "next" branch of xing/canarist and the master branch of some/other
        and executes no command in xing/canarist and "yarn test" in some/other.

    $ canarist -r [git@github.com:xing/canarist.git -d canarist] -r [git@github.com:my/canarist.git -d my-canarist]
        Clones xing/canarist into canarist and my/canarist into my-canarist inside a temporary directory.

    $ canarist -r ~/work/canarist -r ~/work/other -m '{"resolutions":{"typescript":"3.2.4"},"devDependencies":{"jest":"23.0.0}}'
        Clones the master branches of both local repositories into a temporary directory
        and additionally installs yarn resolutions and a missing dev dependency.

    $ canarist -r ~/work/canarist -r ~/work/other -r ~/work/other2 -r ~/work/other3
        Clones the master branches of all four local repositories into a temporary directory
        and executes "yarn test" for each of them.

    $ canarist -r ~/work/canarist -r ~/work/other --y "--production=true"
        Clones the master branches of both repositories and installs production dependencies only

    $ canarist -p my-project
        Looks up the project configuration with the name "my-project" in the cosmiconfig
        of the current repository and clones and executes the repositories and commands therein.
        Read more: https://github.com/xing/canarist/blob/master/README.md
`);
}

function invokeCLI(argv: string[]): Config {
  const args: Arguments = subarg(argv, minimistConfig);
  const config: null | CosmiconfigResult = cosmiconfigSync('canarist').search();

  // todo: how about a --no-install or --no-commands flag to enable quick debugging?

  if (args.help) {
    printUsage();
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  }

  try {
    return normalizeConfig(args, config);
  } catch (error) {
    console.error('Error:', error.message);
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

  try {
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
      const content = existsSync(path) ? readFileSync(path, 'utf-8') : '}\n';
      const finalNewLine = content.substr(content.lastIndexOf('}') + 1);
      writeFileSync(path, JSON.stringify(manifest, null, 2) + finalNewLine);
    });

    // todo: allow to configure which files should be merged?
    // todo: might need to get smarter on how to merge .npmrc files
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
  } finally {
    //
  }
} catch (err) {
  process.exitCode = 1;
  console.error('[canarist] exited with error "%s"', err.message);
}
