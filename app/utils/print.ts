/**
 * Open the browser print dialog after the current menu/popover has closed.
 * Calling `window.print` as a timeout callback (unbound) throws Illegal
 * invocation, and printing while a Radix menu is still mounted can crash React.
 */
export function printPage() {
  window.setTimeout(() => {
    try {
      window.print();
    } catch {
      // Some browsers reject print() outside a direct user gesture.
    }
  }, 300);
}
