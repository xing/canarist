#!/usr/bin/env node

const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const explorer = require('cosmiconfig')('citgm');
const gitUrlParse = require('git-url-parse');
const makeDir = require('make-dir');
const mergeOptions = require('merge-options');
const writePkg = require('write-pkg');

const normalizeWorkspaceVersions = require('./normalize-workspace-versions');

const config = normalizeConfig(explorer.searchSync().config);

makeDir.sync(config.target);

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

function normalizeConfig(config) {
  config.target =
    config.target || fs.mkdtempSync(path.join(os.tmpdir(), 'citgm'));

  config.repositories = config.repositories.map(input => {
    const { name } = gitUrlParse(input.repository || input);
    const directoryName =
      name === '.'
        ? path.basename(path.resolve(input.repository || input))
        : name;

    const {
      repository = input,
      branch = 'master',
      commands = ['yarn test'],
      directory = directoryName,
    } = input;

    return { repository, directory, branch, commands };
  });

  return config;
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

function fixManifest(manifestPath, manifest) {
  if (!manifest.version) {
    manifest.version = '0.0.0-test';
    writePkg.sync(manifestPath, manifest);
  }
}

function collectWorkspaces(directory, { workspaces }) {
  return [
    directory,
    ...workspaces.map(pattern => path.join(directory, pattern)),
  ];
}

config.repositories.forEach(({ repository, directory, branch }) => {
  cloneRepository(repository, path.join(config.target, directory), branch);

  const manifestPath = path.join(config.target, directory, 'package.json');
  const manifest = require(manifestPath);

  fixManifest(manifestPath, manifest);

  rootManifest.workspaces.push(...collectWorkspaces(directory, manifest));
});

normalizeWorkspaceVersions(rootManifest.workspaces, true);

writePkg.sync(rootManifestPath, rootManifest);

child_process.spawnSync('yarn', { stdio: 'inherit', cwd: config.target });

config.repositories.forEach(({ directory, commands }) => {
  commands.forEach(input => {
    const [command, ...args] = input.split(' ');
    if (command) {
      child_process.spawnSync(command, args, {
        cwd: path.join(config.target, directory),
        stdio: 'inherit',
      });
    }
  });
});
