#!/usr/bin/env node

const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const explorer = require('cosmiconfig')('citgm');
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
  console.log('Usage:', process.argv[1]);
  process.exit(0);
}

const config = normalizeConfig(
  process.argv.length > 2
    ? normalizeArguments(argv)
    : explorer.searchSync().config
);

const rootManifestPath = path.join(config.target, 'package.json');
const rootManifest = mergeOptions.call(
  { concatArrays: true },
  {
    name: 'citgm-root',
    version: '0.0.0-private',
    private: true,
    workspaces: [],
  },
  config.rootManifest
);

function cloneRepository(repository, directory, branch) {
  child_process.spawnSync(
    'git',
    ['clone', repository, directory, '--branch', branch, '--depth', '1'],
    {
      stdio: 'inherit',
    }
  );
}

if (!config.target) {
  config.target = fs.mkdtempSync(path.join(os.tmpdir(), 'citgm'));
} else {
  makeDir.sync(config.target);
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
    ...workspaces.map(pattern => path.join(directory, pattern))
  );
});

normlizeWorkspaces(rootManifest.workspaces, true);

writePkg.sync(rootManifestPath, rootManifest);

child_process.spawnSync('yarn', { stdio: 'inherit', cwd: config.target });

config.repositories.forEach(({ directory, commands }) => {
  commands.forEach(input => {
    const [command, ...args] = input.split(' ');
    if (typeof command === 'string' && command !== '') {
      child_process.spawnSync(command, args, {
        cwd: path.join(config.target, directory),
        stdio: 'inherit',
      });
    }
  });
});
