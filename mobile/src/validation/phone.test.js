import { maskContact } from './phone';

/*
 * The verification screen prints whatever this returns, so the cases that
 * matter are the ones a person actually types: a Kenyan mobile, a foreign
 * number, and the recovery address someone half-remembers registering with.
 */
describe('maskContact', () => {
  it('masks a Kenyan number the way the service masks it', () => {
    // notifier.maskPhone in auth-service produces exactly this. The two have
    // to agree, or an SMS and the screen that sent it name different numbers.
    expect(maskContact('+254712345678')).toBe('+2547****5678');
    expect(maskContact('+254113388696')).toBe('+2541****8696');
  });

  it('keeps the dial code and the last four, which is what people check', () => {
    expect(maskContact('+447911123456')).toBe('+4479****3456');
  });

  it('keeps the domain of an email, because recovery is about which inbox', () => {
    expect(maskContact('jane.backup@example.com')).toBe('ja***@example.com');
    expect(maskContact('cyril@gmail.com')).toBe('cy***@gmail.com');
  });

  it('hides the length of the address as well as the address', () => {
    // A fixed run of stars rather than one per hidden character, so two
    // addresses on the same domain are not told apart by the width of the mask.
    expect(maskContact('a.very.long.address@example.com')).toBe('a.***@example.com');
    expect(maskContact('a.b@example.com')).toBe('a.***@example.com');
  });

  it('leaves a one-character local part alone rather than erasing it', () => {
    expect(maskContact('a@b.com')).toBe('a***@b.com');
  });

  it('returns an empty string for nothing at all', () => {
    expect(maskContact('')).toBe('');
    expect(maskContact(null)).toBe('');
    expect(maskContact(undefined)).toBe('');
  });
});
