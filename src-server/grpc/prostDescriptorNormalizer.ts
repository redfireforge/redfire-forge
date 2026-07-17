/**
 * Make a protobufjs-generated FileDescriptorSet loadable by prost-reflect (Tauri native).
 *
 * protobufjs `root.toDescriptor()` emits type references as protobuf *relative* names
 * (e.g. `google.protobuf.Timestamp`, or a map-entry `Attributes`) rather than the
 * fully-qualified, leading-dot form protoc produces, and it DROPS per-file
 * `dependency` arrays. prost-reflect resolves type names against a file's declared
 * (transitive) dependencies and expects files in topological order, so such a set
 * fails with e.g. `name 'google.protobuf.Timestamp' is not defined`.
 *
 * This normalizer:
 *   1. Resolves every type reference to its fully-qualified, leading-dot name using
 *      protobuf scope-walking against the types defined in the set.
 *   2. Reconstructs each file's `dependency` array from the types it references.
 *   3. Topologically sorts files so every dependency precedes its dependents.
 */

interface FieldDescriptorProtoLike {
  typeName?: string | null;
  extendee?: string | null;
  jsonName?: string | null;
  /** protobufjs Message helper — preferred when clearing empty strings so they are not wire-encoded. */
  clearExtendee?: () => void;
  clearTypeName?: () => void;
  clearJsonName?: () => void;
}

interface EnumDescriptorProtoLike {
  name?: string | null;
}

interface DescriptorProtoLike {
  name?: string | null;
  field?: FieldDescriptorProtoLike[] | null;
  extension?: FieldDescriptorProtoLike[] | null;
  nestedType?: DescriptorProtoLike[] | null;
  enumType?: EnumDescriptorProtoLike[] | null;
}

interface MethodDescriptorProtoLike {
  inputType?: string | null;
  outputType?: string | null;
}

interface ServiceDescriptorProtoLike {
  method?: MethodDescriptorProtoLike[] | null;
}

interface FileDescriptorProtoLike {
  name?: string | null;
  package?: string | null;
  dependency?: string[] | null;
  messageType?: DescriptorProtoLike[] | null;
  enumType?: EnumDescriptorProtoLike[] | null;
  service?: ServiceDescriptorProtoLike[] | null;
  extension?: FieldDescriptorProtoLike[] | null;
}

export interface FileDescriptorSetLike {
  file?: FileDescriptorProtoLike[] | null;
}

function buildTypeToFileMap(files: FileDescriptorProtoLike[]): Map<string, string> {
  const map = new Map<string, string>();

  const walkMessages = (messages: DescriptorProtoLike[] | null | undefined, prefix: string, fileName: string) => {
    for (const message of messages ?? []) {
      if (!message.name) continue;
      const fq = `${prefix}.${message.name}`;
      map.set(fq, fileName);
      for (const nestedEnum of message.enumType ?? []) {
        if (nestedEnum.name) map.set(`${fq}.${nestedEnum.name}`, fileName);
      }
      walkMessages(message.nestedType, fq, fileName);
    }
  };

  for (const file of files) {
    const fileName = file.name ?? '';
    if (!fileName) continue;
    const pkgPrefix = file.package ? `.${file.package}` : '';
    walkMessages(file.messageType, pkgPrefix, fileName);
    for (const topEnum of file.enumType ?? []) {
      if (topEnum.name) map.set(`${pkgPrefix}.${topEnum.name}`, fileName);
    }
  }

  return map;
}

/**
 * Resolve a (possibly relative) protobuf type reference to its fully-qualified,
 * leading-dot name using scope-walking, matching protoc's name resolution rules.
 * Returns the original reference unchanged when it cannot be resolved within the set.
 */
function resolveTypeReference(
  reference: string,
  scopeFqn: string,
  knownTypes: ReadonlySet<string>,
): string {
  if (reference.startsWith('.')) {
    return reference; // already fully-qualified
  }

  // Candidate enclosing scopes, most specific first: `.a.b.c`, `.a.b`, `.a`, ``.
  const scopeParts = scopeFqn.replace(/^\./, '').split('.').filter(Boolean);
  for (let depth = scopeParts.length; depth >= 0; depth -= 1) {
    const prefix = depth > 0 ? `.${scopeParts.slice(0, depth).join('.')}` : '';
    const candidate = `${prefix}.${reference}`;
    if (knownTypes.has(candidate)) {
      return candidate;
    }
  }

  return reference;
}

interface ResolveContext {
  knownTypes: ReadonlySet<string>;
  typeToFile: ReadonlyMap<string, string>;
  fileName: string;
  deps: Set<string>;
}

function resolveAndRecord(
  ctx: ResolveContext,
  scopeFqn: string,
  reference: string | null | undefined,
): string | null | undefined {
  if (!reference) return reference;
  const resolved = resolveTypeReference(reference, scopeFqn, ctx.knownTypes);
  const definingFile = ctx.typeToFile.get(resolved);
  if (definingFile && definingFile !== ctx.fileName) {
    ctx.deps.add(definingFile);
  }
  return resolved;
}

function normalizeFileReferences(file: FileDescriptorProtoLike, ctx: ResolveContext): void {
  const pkgScope = file.package ? `.${file.package}` : '';

  const normalizeField = (field: FieldDescriptorProtoLike, scopeFqn: string) => {
    field.typeName = resolveAndRecord(ctx, scopeFqn, field.typeName) ?? field.typeName;
    field.extendee = resolveAndRecord(ctx, scopeFqn, field.extendee) ?? field.extendee;
  };

  const walkMessages = (messages: DescriptorProtoLike[] | null | undefined, scopeFqn: string) => {
    for (const message of messages ?? []) {
      const messageScope = message.name ? `${scopeFqn}.${message.name}` : scopeFqn;
      for (const field of message.field ?? []) normalizeField(field, messageScope);
      for (const extension of message.extension ?? []) normalizeField(extension, messageScope);
      walkMessages(message.nestedType, messageScope);
    }
  };

  walkMessages(file.messageType, pkgScope);
  for (const extension of file.extension ?? []) normalizeField(extension, pkgScope);
  for (const service of file.service ?? []) {
    for (const method of service.method ?? []) {
      method.inputType = resolveAndRecord(ctx, pkgScope, method.inputType) ?? method.inputType;
      method.outputType = resolveAndRecord(ctx, pkgScope, method.outputType) ?? method.outputType;
    }
  }
}

function topologicallySortFiles(
  files: FileDescriptorProtoLike[],
  dependencies: Map<string, Set<string>>,
): FileDescriptorProtoLike[] {
  const byName = new Map<string, FileDescriptorProtoLike>();
  for (const file of files) {
    if (file.name) byName.set(file.name, file);
  }

  const sorted: FileDescriptorProtoLike[] = [];
  const visited = new Set<string>();
  const onStack = new Set<string>();

  const visit = (name: string) => {
    if (visited.has(name)) return;
    if (onStack.has(name)) return; // cycle guard — should not happen for valid protos
    onStack.add(name);
    for (const dep of dependencies.get(name) ?? []) {
      if (byName.has(dep)) visit(dep);
    }
    onStack.delete(name);
    visited.add(name);
    const file = byName.get(name);
    if (file) sorted.push(file);
  };

  for (const file of files) {
    if (file.name) visit(file.name);
  }

  // Preserve any nameless files (defensive) by appending at the end.
  for (const file of files) {
    if (!file.name) sorted.push(file);
  }

  return sorted;
}

/**
 * protobufjs `toDescriptor()` often leaves empty-string `extendee` / `typeName` on
 * fields (especially synthetic map-entry messages). On the wire those empty strings
 * are still encoded, so prost-reflect treats the field as an extension and fails with:
 *   message '….Attributes' does not define '1' as an extension number
 *
 * Clear empty strings so absent optional fields stay absent.
 */
function clearEmptyFieldStrings(field: FieldDescriptorProtoLike): void {
  if (!field.extendee) {
    if (typeof field.clearExtendee === 'function') field.clearExtendee();
    else field.extendee = null;
  }
  if (!field.typeName) {
    if (typeof field.clearTypeName === 'function') field.clearTypeName();
    else field.typeName = null;
  }
  if (!field.jsonName) {
    if (typeof field.clearJsonName === 'function') field.clearJsonName();
    else field.jsonName = null;
  }
}

function sanitizeEmptyDescriptorStrings(file: FileDescriptorProtoLike): void {
  const walkMessages = (messages: DescriptorProtoLike[] | null | undefined) => {
    for (const message of messages ?? []) {
      for (const field of message.field ?? []) clearEmptyFieldStrings(field);
      for (const extension of message.extension ?? []) clearEmptyFieldStrings(extension);
      walkMessages(message.nestedType);
    }
  };

  for (const extension of file.extension ?? []) clearEmptyFieldStrings(extension);
  walkMessages(file.messageType);
}

/**
 * Mutates and returns the given FileDescriptorSet so prost-reflect can load it.
 */
export function normalizeFileDescriptorSetForProst<T extends FileDescriptorSetLike>(set: T): T {
  const files = set.file ?? [];
  if (files.length === 0) return set;

  // Run before reference rewriting so empty extendee/typeName never participate
  // in dependency discovery and never survive into the encoded protoset.
  for (const file of files) {
    sanitizeEmptyDescriptorStrings(file);
  }

  const typeToFile = buildTypeToFileMap(files);
  const knownTypes = new Set(typeToFile.keys());
  const dependencies = new Map<string, Set<string>>();

  for (const file of files) {
    const fileName = file.name ?? '';
    const deps = new Set<string>(file.dependency ?? []);
    normalizeFileReferences(file, { knownTypes, typeToFile, fileName, deps });
    dependencies.set(fileName, deps);
  }

  // Sort first so missing declared deps take the cycle/skip path, then strip dangling
  // entries — prost-reflect rejects a declared dependency it cannot find.
  set.file = topologicallySortFiles(files, dependencies);

  for (const file of set.file) {
    const deps = dependencies.get(file.name ?? '') ?? new Set<string>();
    for (const dep of [...deps]) {
      const present = set.file.some((candidate) => candidate.name === dep);
      if (!present) deps.delete(dep);
    }
    file.dependency = [...deps];
    // Re-sanitize after reference rewrites (empty strings can reappear from defaults).
    sanitizeEmptyDescriptorStrings(file);
  }

  return set;
}
