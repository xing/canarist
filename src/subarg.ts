import minimist from 'minimist';

// This is taken from https://github.com/substack/subarg/pull/6
export function subarg(
  args: string[],
  opts?: minimist.Opts
): minimist.ParsedArgs {
  let level = 0,
    index;
  const args_ = [];

  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] === 'string' && /^\[/.test(args[i])) {
      if (level++ === 0) {
        index = i;
      }
    }
    if (typeof args[i] === 'string' && /\]$/.test(args[i])) {
      if (--level > 0) continue;

      const sub = args.slice(index, i + 1);
      if (typeof sub[0] === 'string') {
        sub[0] = sub[0].replace(/^\[/, '');
      }
      if (sub[0] === '') sub.shift();

      const n = sub.length - 1;
      if (typeof sub[n] === 'string') {
        sub[n] = sub[n].replace(/\]$/, '');
      }
      if (sub[n] === '') sub.pop();

      args_.push(subarg(sub, opts));
    } else if (level === 0) args_.push(args[i]);
  }

  const argv = minimist(args_ as string[], opts);
  return argv;
}
