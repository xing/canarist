import { subarg } from '../subarg';

describe('subarg', () => {
  it('should parse simple parameters', () => {
    const parsed = subarg(
      'beep -a1 -b=1 -c 1 -d --aa1 --ab=2 --ac 2 --ad -- boop'.split(/\s+/)
    );

    expect(parsed).toEqual({
      _: ['beep', 'boop'],
      a: 1,
      b: 1,
      c: 1,
      d: true,
      aa1: true,
      ab: 2,
      ac: 2,
      ad: true,
    });
  });

  it('should parse nested contexts', () => {
    const parsed = subarg('-a [foo -b1 bar --baz 1 -- boo]'.split(/\s+/));

    expect(parsed).toEqual({
      _: [],
      a: {
        _: ['foo', 'bar', 'boo'],
        b: 1,
        baz: 1,
      },
    });
  });

  it('should parse recursive contexts', () => {
    const parsed = subarg('-a [ -b [ -c [ -d 5 ] ] ] -e 3'.split(/\s+/));

    expect(parsed).toEqual({
      _: [],
      a: {
        _: [],
        b: {
          _: [],
          c: {
            _: [],
            d: 5,
          },
        },
      },
      e: 3,
    });
  });
});
