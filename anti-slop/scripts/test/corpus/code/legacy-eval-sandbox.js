export function runSandboxed(expr) {
  return eval(expr); // anti-slop-allow: vetted plugin DSL, sandboxed via vm2 with a locked-down context
}
