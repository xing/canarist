#!/usr/bin/env node

const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const explorer = require('cosmiconfig')('canarist');
const makeDir = require('make-dir');
const mergeOptions = require('merge-options');
const writePkg = require('write-pkg');

const { normalizeArguments, normalizeConfig } = require('./normalize');
const normlizeWorkspaces = require('./normalize-workspaces');
const subarg = require('./subarg-patched');

const argv = subarg(process.argv.slice(2), {
  alias: {
    help: ['h'],
    repository: ['r'],
    branch: ['b'],
    command: ['c'],
    directory: ['d'],
    'root-manifest': ['m'],
  },
});

if (argv.help || argv._.includes('help')) {
  printUsage();

  process.exit(0);
}

const exploredConfig = explorer.searchSync();
const config = normalizeConfig(
  process.argv.length > 2
    ? normalizeArguments(argv)
    : exploredConfig
    ? exploredConfig.config
    : null
);

if (!config) {
  printUsage();

  process.exit(1);
}

if (!config.target) {
  config.target = fs.mkdtempSync(path.join(os.tmpdir(), 'canarist'));
} else {
  makeDir.sync(config.target);
}

const rootManifestPath = path.join(config.target, 'package.json');
const rootManifest = mergeOptions.call(
  { concatArrays: true },
  {
    name: 'canarist-root',
    version: '0.0.0-private',
    private: true,
    workspaces: [],
  },
  config.rootManifest
);

function printUsage() {
  console.log(
    'Usage: canarist options [<target>]',
    '\n\nOptions:',
    '\n\t--repository, -r',
    '\n\t    The URL (or local file path) to a repository to clone.',
    '\n\t    This option accepts sub-arguments (see examples):',
    '\n\t        --branch, -b',
    '\n\t        --command, -c',
    '\n\t        --directory, -d',
    '\n\t--root-manifest, -m',
    '\n\t    A valid JSON string that should be merged into the',
    '\n\t    generated root manifest.',
    '\n\nExamples:',
    "\n\t$ canarist -r git@github.com:xing/hops.git -r [git@github.com:some/other.git -c 'yarn build -p' -c 'yarn test']",
    '\n\t    Clones xing/hops and some/other into a temporary directory',
    '\n\t    and executes "yarn test" in xing/hops and "yarn build -p" and "yarn test" in some/other',
    '\n\n\t$ canarist -r [git@github.com:xing/hops.git -c] -r git@github.com:some/other.git',
    '\n\t    Clones xing/hops and some/other into a temporary directory.',
    '\n\t    and executes no command in xing/hops and "yarn test" in some/other.',
    '\n\n\t$ canarist -r [git@github.com:xing/hops.git -b next] -r git@github.com:some/other.git ~/work/integration-tests',
    '\n\t    Clones the "next" branch of xing/hops and the master branch of some/other',
    '\n\t    into the target directory and executes "yarn test" in both.',
    '\n\n\t$ canarist -r [git@github.com:xing/hops.git -d xing-hops] -r [git@github.com:my/hops.git -d my-hops]',
    '\n\t    Clones xing/hops into xing-hops and my/hops into my-hops inside a temporary directory.',
    '\n\n\t$ canarist -r ~/work/hops -r ~/work/other -m \'{"resolutions":{"typescript":"3.2.4"},"devDependencies":{"jest":"23.0.0}}\'',
    '\n\t    Clones the master branches of both local repositories into a temporary directory',
    '\n\t    and additionally installs yarn resolutions and a missing dev dependency.',
    '\n\n\t$ canarist -r ~/work/hops -r ~/work/other -r ~/work/other2 -r ~/work/other3',
    '\n\t    Clones the master branches of all three local repositories into a temporary directory',
    '\n\t    and executes "yarn test" for each of them.',
    '\n'
  );
}

function cloneRepository(repository, directory, branch) {
  child_process.spawnSync(
    'git',
    ['clone', repository, directory, '--branch', branch, '--depth', '1'],
    {
      stdio: 'inherit',
    }
  );
}

config.repositories.forEach(({ repository, directory, branch }) => {
  cloneRepository(repository, path.join(config.target, directory), branch);

  const manifestPath = path.join(config.target, directory, 'package.json');
  const manifest = require(manifestPath);

  if (!manifest.version) {
    manifest.version = '0.0.0-test';
    writePkg.sync(manifestPath, manifest);
  }

  rootManifest.workspaces.push(
    directory,
    ...manifest.workspaces.map((pattern) => path.join(directory, pattern))
  );
});

normlizeWorkspaces(rootManifest.workspaces, true);

writePkg.sync(rootManifestPath, rootManifest);

child_process.spawnSync('yarn', { stdio: 'inherit', cwd: config.target });

config.repositories.forEach(({ directory, commands }) => {
  commands.forEach((input) => {
    const [command, ...args] = input.split(' ');
    if (typeof command === 'string' && command !== '') {
      const { status } = child_process.spawnSync(command, args, {
        cwd: path.join(config.target, directory),
        stdio: 'inherit',
      });

      if (status !== 0) {
        process.exitCode = status;
      }
    }
  });
});
