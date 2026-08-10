import { describe, expect, it } from 'vitest';
import pathShim, {
  basename,
  delimiter,
  dirname,
  extname,
  isAbsolute,
  join,
  resolve,
  sep,
} from './path-browser';

describe('path-browser shim', () => {
  it('exposes unix-like separators', () => {
    expect(sep).toBe('/');
    expect(delimiter).toBe(':');
  });

  it('dirname handles empty, root, and nested paths', () => {
    expect(dirname('')).toBe('.');
    expect(dirname('/')).toBe('.');
    expect(dirname('/a')).toBe('/');
    expect(dirname('/a/b/c.txt')).toBe('/a/b');
    expect(dirname('a/b/c.txt')).toBe('a/b');
  });

  it('basename and extname resolve correctly', () => {
    expect(basename('/a/b/c.txt')).toBe('c.txt');
    expect(basename('/a/b/c.txt', '.txt')).toBe('c');
    expect(basename('/a/b/c.txt', '.json')).toBe('c.txt');
    expect(basename(42 as unknown as string)).toBe('');
    expect(extname('/a/b/c.txt')).toBe('.txt');
    expect(extname('/a/b/c')).toBe('');
  });

  it('join and resolve normalize repeated slashes', () => {
    expect(join('/a', 'b', '//c')).toBe('/a/b/c');
    expect(resolve('a', 'b')).toBe('/a/b');
    expect(resolve('/a', 'b')).toBe('/a/b');
  });

  it('isAbsolute checks leading slash', () => {
    expect(isAbsolute('/a/b')).toBe(true);
    expect(isAbsolute('a/b')).toBe(false);
  });

  it('default export mirrors named helpers', () => {
    expect(pathShim.join('a', 'b')).toBe('a/b');
    expect(pathShim.dirname('/a/b')).toBe('/a');
  });
});
