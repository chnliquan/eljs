# Repository agent instructions

## TSDoc

- When creating or modifying a public API, add or update standard TSDoc for
  exported classes, interfaces, type aliases, functions, and enums, as well as
  public extension points intended for package consumers.
- When creating or modifying an internal declaration, add concise TSDoc when it
  defines serialized or persisted data, a trust boundary, lifecycle or
  concurrency state, recovery semantics, a compatibility contract, or a
  cross-module invariant. Internal visibility alone is not a reason to omit
  documentation from declarations such as lock metadata or protocol payloads.
- Use `@internal` when an exported declaration exists only for package-internal
  module boundaries and is not part of the consumer-facing API.
- Document the API contract, lifecycle, ordering, errors, side effects, and
  non-obvious constraints where relevant. Do not add comments that only
  restate an identifier or its TypeScript type.
- Write TSDoc in Chinese for this repository and its generated source files
- Use standard tags such as `@typeParam`, `@param`, `@returns`, `@throws`,
  `@remarks`, and `@example` when they add useful information. Keep types in
  TypeScript signatures.
- Do not end TSDoc summaries, remarks, or tag descriptions with a Chinese or
  English full stop (`。` or `.`).
- Update existing TSDoc whenever behavior or signatures change. Match the
  language used by the surrounding API documentation.
- Do not add TSDoc to straightforward local helpers, incidental data shapes, or
  obvious members only to increase documentation coverage. For qualifying
  internal declarations, document the contract and non-obvious fields without
  narrating every property.
- Avoid `{@link Class.instanceMember}` references because TypeScript may resolve
  them as static namespace members. Use inline code for instance members or
  link to the containing declaration.
- Before finishing, run type checks for affected packages and ESLint over the
  changed source files. `tsdoc/syntax` validates comments that are present;
  review the diff explicitly to ensure newly added or changed public APIs and
  qualifying internal declarations are documented.

## Generated code comments

- In generated source files, add concise Chinese implementation comments at
  key decision points and non-obvious logic, including input trust boundaries,
  compatibility fallbacks, recursive data transformations, lifecycle ordering,
  and side effects such as publishing or overwriting files.
- Explain the reason, invariant, or user-facing consequence of the code rather
  than restating the operation or its TypeScript type.
- Do not comment straightforward declarations, assignments, or control flow;
  comments should help a generated-project maintainer safely modify code they
  did not write.
- Keep comments in templates valid after rendering for every supported option,
  and update the relevant template contract test when a comment documents a
  critical invariant.
