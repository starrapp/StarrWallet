/**
 * Onboarding Store
 *
 * Ephemeral in-memory store for passing the mnemonic between
 * create → backup screens.
 */

let mnemonic: string[] | null = null;

export function setMnemonic(value: string[]): void {
  mnemonic = value;
}

export function consumeMnemonic(): string[] | null {
  const value = mnemonic;
  mnemonic = null;
  return value;
}
