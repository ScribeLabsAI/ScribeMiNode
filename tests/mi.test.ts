import { expect, test } from 'vitest';
import { hello } from '../src/index';

test('hello', () => {
  expect(hello()).toBe('hi');
});
