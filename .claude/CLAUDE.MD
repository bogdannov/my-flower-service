# Posts Service - Claude Code Instructions

## CRITICAL: Always Follow These Rules

### Fundamental Rules:

We must not use "any" in code as this is an error prone practice that undermines TypeScript's type safety. Always define and use specific types.

ALWAYS read and understand relevant files before proposing code edits. Do not speculate about code you have not inspected. If the user references a specific file/path, you MUST open and inspect it before explaining or proposing fixes. Be rigorous and persistent in searching code for key facts.
Thoroughly review the style, conventions, and abstractions of the codebase before implementing new features or abstractions.

Please write a high-quality, general-purpose solution using the standard tools available. Do not create helper scripts or workarounds to accomplish the task more efficiently. Implement a solution that works correctly for all valid inputs, not just the test cases. Do not hard-code values or create solutions that only work for specific test inputs. Instead, implement the actual logic that solves the problem generally.
Focus on understanding the problem requirements and implementing the correct algorithm. Tests are there to verify correctness, not to define the solution. Provide a principled implementation that follows best practices and software design principles.
If the task is unreasonable or infeasible, or if any of the tests are incorrect, please inform me rather than working around them. The solution should be robust, maintainable, and extendable.

After receiving tool results, carefully reflect on their quality and determine optimal next steps before proceeding. Use your thinking to plan and iterate based on this new information, and then take the best next action.
If you create any temporary new files, scripts, or helper files for iteration, clean up these files by removing them at the end of the task.

Avoid over-engineering. Only make changes that are directly requested or clearly necessary. Keep solutions simple and focused.

When working on this service, you MUST follow these architectural patterns without exception:

### 0. Core Principles
- Handlers for API endpoints must be tiny and delegate all logic to services and handle HTTP-specific concerns (status codes, request parsing, etc.)
- Do not call handlers .handler in the name of the file it's gonna be failed by serverless framework, just name it health.ts, posts.ts, etc.
- All handlers must be located in handlers directory
- In case you add/moify routes - update postman collection file in the root.

### 1. Dependency Injection Pattern (MANDATORY)

**ALL services, repositories, AWS clients, and modules MUST use Factory pattern with typed-inject.**

Example:
```typescript
export class ServiceFactory extends BaseFactory<Service> {
  static injectionToken = "ServiceFactory" as const;
  static inject = [ConfigFactory.injectionToken] as const;

  constructor(protected configFactory: ConfigFactory) {
    super();
  }

  protected async _make() {
    const config = await this.configFactory.make();
    return new Service(config);
  }
}
```

**NEVER:**
- Use `new ServiceName()` directly
- Create singleton instances
- Use static factory methods

**ALWAYS:**
- Create Factory extending BaseFactory<T>
- Register in src/bootstrap/inject.ts
- Use `await inject().ServiceName()`

### 2. Configuration Management (MANDATORY)

**NO `process.env` usage anywhere except Config.ts**

**ALWAYS:**
- Add all env variables to src/module/config/Config.ts with Zod validation
- Inject ConfigFactory into services that need config
- Use `config.get().VARIABLE_NAME`

**NEVER:**
- Access `process.env.VARIABLE` directly in services/handlers
- Use environment variables without Zod validation

### 3. Code Reuse (MANDATORY)

**Before writing ANY new code:**

1. Check if a factory already exists → Use it
2. Check if similar service exists → Adapt it
3. Check if utility function exists → Use it
4. Check if types exist → Import them

**Minimize new code. Maximize reuse.**

### 4. Reference Implementations

**ALWAYS review these before implementing:**

- `src/bootstrap/factory/module/logger.factory.ts` - Factory pattern
- `src/bootstrap/inject.ts` - DI registration
- `src/module/config/Config.ts` - Configuration management
- `src/handler/health.ts` - Handler pattern
- `src/bootstrap/factory/base.factory.ts` - Base factory class

### 5. Implementation Checklist

For EVERY new service/repository/client, verify:

- [ ] Created Factory extending BaseFactory<T>
- [ ] Has static injectionToken
- [ ] Has static inject array with dependencies
- [ ] Registered in inject.ts
- [ ] NO process.env usage
- [ ] NO direct instantiation
- [ ] Reused existing code

### 6. Documentation

**Full guidelines at:**
- `DEVELOPMENT_GUIDELINES.md` - Complete development standards

**Read these documents before starting any implementation work.**

### 7. When in Doubt

1. Check DEVELOPMENT_GUIDELINES.md
2. Look at reference implementations
3. Follow existing patterns exactly
4. Consistency over cleverness
5. Ask for clarification if unsure


### 8. Single source of truth
We must ensure that there is a single source of truth for types, schema definitions, and configurations. Duplication leads to inconsistencies and bugs.
---

**These rules are non-negotiable. Follow them in every session.**


### Comments and Documentation

**When to comment:**
- Complex business logic that isn't self-evident
- Non-obvious workarounds or edge cases
- API endpoint behavior or HTTP status codes
- Temporary fixes that need follow-up

**When NOT to comment:**
- Self-explanatory code
- Restating what the code does
- Placeholder comments like `// TODO` or `// ... existing code`

**Example of good comment:**
```typescript
// OAS schema specifies 201, but it doesn't seem to be applied automatically.
// Set status manually for now — if a proper OAS-based solution is found, please remove this line.
this.context.status = 201;
```

### Verification Protocol

**Before declaring work complete:**

1. **Type check:** `npm run tsc` must pass
2. **Lint:** `npm run lint:fix` must pass (runs auto-fix)
3. **Tests:** Relevant tests must pass and be updated `npm run tests`


### Security

- ✅ Validate all user input
- ✅ Use authorization decorators: `@AuthorizeAccount`, `@CheckAuthority`
- ❌ **NO** SQL injection, XSS, command injection vulnerabilities
- ✅ Sanitize data before logging (no PII in logs)
- ✅ Use parameterized DynamoDB queries
- Tell in case you see any vulnerabilities or security issues in code.
