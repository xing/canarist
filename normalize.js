const gitUrlParse = require('git-url-parse');

function normalizeArguments(argv) {
  const {
    _: [target],
    repository: repositories,
    'root-manifest': rootManifest,
  } = argv;

  return {
    target,
    rootManifest: JSON.parse(rootManifest || '{}'),
    repositories: repositories.map(input => {
      const {
        _: [repository = input],
        branch,
        directory,
        command: commands,
      } = input;

      return {
        repository,
        branch,
        commands:
          commands === true
            ? ['']
            : Array.isArray(commands)
            ? commands
            : [commands],
        directory,
      };
    }),
  };
}
module.exports.normalizeArguments = normalizeArguments;

function normalizeConfig(config) {
  if (!config) {
    return null;
  }

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
module.exports.normalizeConfig = normalizeConfig;
