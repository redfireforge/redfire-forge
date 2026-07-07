/** Join className tokens while ignoring empty values. */
export function joinClassNames(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ');
}
