import { generateNonce } from './../';

describe('generateNonce', () => {
  it('should generate a random string', () => {
    expect(generateNonce()).not.toStrictEqual(generateNonce());
    expect(generateNonce()).not.toStrictEqual(generateNonce());
    expect(generateNonce()).not.toStrictEqual(generateNonce());
    expect(generateNonce()).not.toStrictEqual(generateNonce());
  });
});
