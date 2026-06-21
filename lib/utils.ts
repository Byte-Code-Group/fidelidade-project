// Concatena classes ignorando valores falsy. (cn minimalista, sem deps.)
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
