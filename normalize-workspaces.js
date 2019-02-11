#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const glob = require('fast-glob');
const semver = require('semver');

const dependencyTypes = [
  'dependencies',
  'peerDependencies',
  'devDependencies',
  'optionalDependencies',
  'bundledDependencies',
];

function logMismatch(type, file, name, versions, dependencies) {
  console.error(
    'ERROR! %s mismatch in (%s) the current version of "%s" (%s) does not satisfy range "%s"',
    type,
    file,
    name,
    versions[name],
    dependencies[name]
  );
}

function normalizeWorkspaceVersions(patterns, write = false) {
  const versions = {};
  const manifests = glob
    .sync(patterns.map((pattern) => path.join(pattern, 'package.json')))
    .map((file) => {
      const manifest = require(path.resolve(file));

      versions[manifest.name] = manifest.version;

      return {
        file,
        manifest,
      };
    });

  manifests.forEach(({ file, manifest }) => {
    dependencyTypes.forEach((type) => {
      const dependencies = manifest[type] || {};

      Object.keys(dependencies).forEach((name) => {
        if (!versions[name]) {
          return;
        }

        if (!semver.satisfies(versions[name], dependencies[name])) {
          logMismatch(type, file, name, versions, dependencies);
          if (require.main === module) {
            process.exitCode = 1;
          }
        }

        if (type === 'peerDependencies') {
          return;
        }

        if (!dependencies[name].includes(versions[name])) {
          dependencies[name] = versions[name];
        }
      });
    });

    if (write) {
      fs.writeFileSync(path.resolve(file), JSON.stringify(manifest, null, 2));
    }
  });
}
module.exports = normalizeWorkspaceVersions;

if (require.main === module) {
  let pathToManifest = process.argv[2] || 'package.json';

  if (!pathToManifest.endsWith('package.json')) {
    pathToManifest = path.join(pathToManifest, 'package.json');
  }

  process.chdir(path.dirname(pathToManifest));

  const manifest = require(path.resolve(pathToManifest));
  normalizeWorkspaceVersions(manifest.workspaces);
}
