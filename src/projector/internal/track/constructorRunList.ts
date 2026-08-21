export type RunMethod = { name: string; options: unknown };

// The saved module constructor can be missing the module's executeOnLoad methods
// (e.g. a module added before its introspection populated its method list), which
// leaves data-loading modules blank. Re-add any class-declared executeOnLoad method
// that is absent from the saved constructor (with default options), running loaders
// before the saved methods. Matrix is handled separately and never appears here.
export function resolveConstructorRunList(
  savedConstructor: unknown,
  classMethods: unknown
): RunMethod[] {
  const saved = Array.isArray(savedConstructor) ? savedConstructor : [];
  const nonMatrix: RunMethod[] = [];
  for (const mm of saved) {
    const m = mm as { name?: unknown; options?: unknown };
    const name = typeof m.name === "string" ? m.name : "";
    if (!name || name === "matrix") continue;
    nonMatrix.push({ name, options: m.options });
  }
  const present = new Set(nonMatrix.map((mm) => mm.name));

  const cls = Array.isArray(classMethods) ? classMethods : [];
  const missing: RunMethod[] = [];
  for (const cm of cls) {
    const c = cm as { name?: unknown; executeOnLoad?: unknown; options?: unknown };
    const name = typeof c.name === "string" ? c.name : "";
    if (!name || name === "matrix" || c.executeOnLoad !== true || present.has(name)) continue;
    const options = Array.isArray(c.options)
      ? c.options.map((o) => {
          const opt = o as { name?: unknown; defaultVal?: unknown };
          return { name: opt?.name, value: opt?.defaultVal };
        })
      : [];
    missing.push({ name, options });
  }
  return [...missing, ...nonMatrix];
}
