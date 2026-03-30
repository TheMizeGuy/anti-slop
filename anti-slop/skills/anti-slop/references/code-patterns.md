# Code Anti-Patterns

Patterns that mark code as AI-generated. Avoid all of these. Studies measuring AI code quality (GitClear 2024, OX Security 2025) consistently find higher defect rates, more logic errors, and more security vulnerabilities in AI-generated code than in human-written code.

## Comment Slop

### Restating the Code

The most common AI code tell. Comments that say exactly what the code says.

```python
# BAD
counter = 0  # Initialize counter to zero
for item in items:  # Loop through items
    counter += 1  # Increment counter
return counter  # Return the counter

# GOOD (no comments needed -- the code is clear)
counter = 0
for item in items:
    counter += 1
return counter
```

### Trivial JSDoc/Docstrings

Documenting obvious functions with obvious descriptions.

```typescript
// BAD
/**
 * Gets the user by ID
 * @param id - The ID of the user
 * @returns The user object
 */
function getUserById(id: string): User {

// GOOD (the signature says everything)
function getUserById(id: string): User {
```

Only document non-obvious behavior: side effects, exceptions, edge cases, business reasons, surprising return values.

### "This function does X" Above a Function Named X

```python
# BAD
# Validates user input
def validate_user_input(data):

# GOOD (just the function, no redundant comment)
def validate_user_input(data):
```

### TODO Comments Without Plans

```python
# BAD
# TODO: Add error handling
# TODO: Improve performance
# TODO: Add logging

# GOOD (only if there's a real plan)
# TODO(#1234): Rate limit this endpoint before launch
```

## Over-Engineering

### Abstraction Layers for Single Implementations

```typescript
// BAD - factory for one type
interface NotificationSender { send(msg: string): void }
class EmailNotificationSender implements NotificationSender { ... }
class NotificationSenderFactory {
  create(type: string): NotificationSender {
    if (type === 'email') return new EmailNotificationSender()
    throw new Error('Unknown type')
  }
}

// GOOD - just the function
function sendEmailNotification(msg: string): void { ... }
```

If there's only one implementation, there's no need for an interface, factory, strategy, or adapter. Add abstraction when the second implementation arrives.

### Configuration Objects for Trivial Values

```python
# BAD -- wrapping a single constant in a config dict
config = {"separator": ","}
result = join_values(data, config)

# GOOD
result = ",".join(data)
```

Note: retry configs, timeout settings, and backoff parameters belong in configuration objects. They change across environments and during incidents. The anti-pattern is wrapping trivial, fixed values in needless config ceremony.

### Helper Functions Used Once

```javascript
// BAD
function formatUserName(first, last) {
  return `${first} ${last}`
}
const displayName = formatUserName(user.first, user.last)

// GOOD
const displayName = `${user.first} ${user.last}`
```

A function earns its existence by being called more than once, or by being complex enough to deserve a name.

### Premature Design Patterns

Do not introduce Strategy, Observer, Builder, Factory, or Adapter patterns unless the code has multiple concrete cases right now. "Might need it later" is not a reason.

## Error Handling Slop

### Swallowing Errors

```python
# BAD
try:
    result = process_data(input)
except Exception:
    pass  # Silently swallowed

# BAD when caller expects a result (None propagates silently)
try:
    result = process_data(input)
except Exception as e:
    logger.error(f"Error: {e}")
    return None
# (Acceptable in fire-and-forget contexts where caller handles None)

# GOOD
result = process_data(input)  # Let it raise if it fails
# OR
try:
    result = process_data(input)
except SpecificError as e:
    raise ProcessingError(f"Failed to process {input.id}") from e
    # Note: at API boundaries, sanitize error messages so internal
    # details don't leak to external callers
```

### Null Checks for Non-Nullable Values

```typescript
// BAD (TypeScript guarantees this is a string)
function greet(name: string): string {
  if (name === null || name === undefined) {
    throw new Error('Name is required')
  }
  return `Hello, ${name}`
}

// GOOD
function greet(name: string): string {
  return `Hello, ${name}`
}
```

Trust the type system when it is enforced. At trust boundaries (API inputs, database results, deserialized data), check regardless of declared types. Type annotations in TypeScript and Python do not enforce runtime behavior. The anti-pattern is redundant null checks deep in internal code where the type system guarantees the value.

### Validation for Impossible States

In languages with compiler-enforced exhaustive matching (Rust, TypeScript with discriminated unions), omitting the default case is correct; the compiler catches new variants. In Python, where match/if-elif is NOT exhaustive, a defensive default is good practice:

```python
# GOOD for Python (match is not exhaustive)
def handle_status(status: Status):
    match status:
        case Status.ACTIVE: ...
        case Status.INACTIVE: ...
        case _: raise ValueError(f"Unknown status: {status}")
```

The anti-pattern is redundant checks where the language already enforces exhaustiveness.

### Try-Catch at Every Layer

```python
# BAD - error handling at every level
def get_user(id):
    try:
        return db.query(User, id)
    except Exception as e:
        logger.error(f"DB error: {e}")
        raise

def get_user_profile(id):
    try:
        user = get_user(id)
        return build_profile(user)
    except Exception as e:
        logger.error(f"Profile error: {e}")
        raise

# GOOD - handle at the boundary
def get_user_profile(id):
    user = db.query(User, id)
    return build_profile(user)

# Error handling at the API/boundary layer
@app.get("/users/{id}")
def user_endpoint(id: str):
    try:
        return get_user_profile(id)
    except UserNotFoundError:
        raise HTTPException(404)
```

## API and Dependency Hallucination

### Hallucinated Methods

AI confidently uses API methods that don't exist. Always verify against documentation.

Common examples:
- Invented configuration options
- Methods with wrong signatures
- Features from different versions of a library
- Mixing APIs from competing frameworks

**Rule:** If writing code that uses a library method, verify it exists in the current version. If unsure, say so.

### Slopsquatting

AI invents package names that sound real. Attackers register these names with malicious code.

A 2024 study by Lanyado et al. found:
- Open-source models hallucinate package names 21.7% of the time
- Commercial models: 5.2% of the time
- 43% of hallucinated packages are repeated consistently
- Attackers have registered these names and gotten thousands of downloads

**Rule:** Never suggest a package without verifying it exists on npm, PyPI, or the relevant registry. If uncertain about a package name, flag it explicitly.

### Deprecated API Usage

AI training data includes outdated code. Common issues:
- `datetime.utcnow()` (deprecated Python 3.12+, use `from datetime import timezone; datetime.now(timezone.utc)`)
- React class components instead of function components
- `componentWillMount` and other removed lifecycle methods
- Old-style string formatting in languages that have template literals

**Rule:** Use current APIs. When in doubt, check the current documentation.

## Code Structure Issues

### Verbose Where Concise Works

```python
# BAD
result = []
for item in items:
    if item.is_active:
        result.append(item.name)

# GOOD
result = [item.name for item in items if item.is_active]
```

Don't use four lines where one expressive line works. But don't sacrifice readability for cleverness either.

### Debugging Residue

AI's iterative debugging loop leaves variant files:
- `auth.py`, `auth_v2.py`, `auth_new.py`
- `component.tsx`, `component_backup.tsx`
- `utils.py`, `utils_old.py`
- `rateLimiter.py`, `rateLimiterSimple.py`, `rateLimiterEnhanced.py`

**Rule:** One file per concept. Delete variants. If a file needs to change, change it in place.

### Convention-Blind Code

Ignoring the codebase's existing patterns:
- Using snake_case in a camelCase codebase
- Using a different ORM pattern than the rest of the project
- Introducing a new error handling strategy
- Using different import styles

**Rule:** Read the codebase first. Match its conventions. When unsure, look at adjacent files.

### Redundant Type Annotations

```typescript
// BAD
const name: string = "Alice"
const count: number = 0
const items: string[] = ["a", "b"]

// GOOD (TypeScript infers these)
const name = "Alice"
const count = 0
const items = ["a", "b"]
```

Only annotate types when the compiler can't infer or when the inferred type is wrong.

## Testing Anti-Patterns

### Testing the Mock

```python
# BAD - this tests the mock, not the code
def test_get_user():
    mock_db = Mock()
    mock_db.query.return_value = User(name="Alice")
    service = UserService(mock_db)
    result = service.get_user(1)
    assert result.name == "Alice"  # Only proves the mock works
```

### Trivial Tests

```python
# BAD
def test_true_is_true():
    assert True

def test_constructor():
    obj = MyClass()
    assert obj is not None
```

### Implementation-Coupled Tests

Tests that break when internal implementation changes but behavior doesn't. Testing private methods, testing the exact sequence of internal calls, asserting on implementation details rather than outputs.

**Rule:** Test behavior and outputs. A test should only break when the behavior changes.

## Security Anti-Patterns

### SQL Injection

```python
# BAD
query = f"SELECT * FROM users WHERE id = '{user_id}'"
cursor.execute(query)

# GOOD (placeholder syntax varies by driver: %s, ?, :name)
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

```javascript
// GOOD (Node.js with pg)
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
```

### XSS (Cross-Site Scripting)

```javascript
// BAD
element.innerHTML = userInput

// GOOD
element.textContent = userInput
```

```jsx
// BAD
<div dangerouslySetInnerHTML={{__html: userContent}} />

// GOOD (sanitize if HTML is truly needed)
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(userContent)}} />
```

### Command Injection

```python
# BAD
subprocess.run(f"convert {filename} output.png", shell=True)

# GOOD (pass args as list, never shell=True with user input)
subprocess.run(["convert", filename, "output.png"])
```

### Path Traversal

```python
# BAD (user_filename could be "../../etc/passwd")
path = os.path.join(base_dir, user_filename)

# GOOD
path = os.path.join(base_dir, user_filename)
if not os.path.realpath(path).startswith(os.path.realpath(base_dir)):
    raise ValueError("Path traversal detected")
```

### Hardcoded Credentials

```python
# BAD
API_KEY = "sk-abc123..."

# MINIMAL (environment variable with startup check)
api_key = os.environ.get("API_KEY")
if not api_key:
    raise RuntimeError("API_KEY environment variable required")

# BETTER (use a secrets manager in production)
# AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager, etc.
```

Environment variables are better than hardcoding but are visible in process listings. For production, use a secrets manager.

### Insecure Randomness

```python
# BAD (for security purposes)
import random
token = random.randint(0, 999999)

# GOOD
import secrets
token = secrets.token_urlsafe(32)
```

Use `secrets` (Python) or `crypto.getRandomValues()` (JS) for tokens, session IDs, passwords, nonces, and salts. `random` / `Math.random()` is fine for non-security purposes like shuffling a playlist.

### eval() with User Input

```python
# BAD
result = eval(user_expression)

# GOOD (for math expressions, use a purpose-built parser)
import simpleeval
result = simpleeval.simple_eval(user_expression)

# GOOD (for Python literals ONLY, not expressions)
import ast
result = ast.literal_eval(user_expression)
# WARNING: ast.literal_eval does NOT evaluate expressions like "2 + 3".
# It only parses literals: strings, numbers, tuples, lists, dicts, booleans, None.
```

### Sensitive Data in Logs

```python
# BAD
logger.info(f"User login: {username} password: {password}")
logger.debug(f"Request body: {request.body}")

# GOOD
logger.info(f"User login: {username}")
# Never log passwords, tokens, PII, or full request bodies
```

## "Looks Right But Isn't" Patterns

These pass code review because the code appears clean and correct. They are the most dangerous AI code patterns.

### Shallow vs Deep Copy Confusion

```python
# BAD (shallow copy, nested mutation leaks through)
config = DEFAULT_CONFIG.copy()
config['database']['host'] = 'new-host'  # Mutates DEFAULT_CONFIG too

# GOOD
import copy
config = copy.deepcopy(DEFAULT_CONFIG)
config['database']['host'] = 'new-host'  # Safe
```

```javascript
// BAD (spread is shallow)
const newState = { ...state }
newState.nested.value = 42     // Mutates original state.nested

// GOOD
const newState = structuredClone(state)
newState.nested.value = 42  // Safe
```

AI uses shallow copies where deep copies are needed, especially with nested structures. The code "looks" safe because a copy operation is present.

### Floating-Point Money Calculations

```python
# BAD -- floating-point imprecision
price = 19.99
tax = price * 0.08  # Not exact
total = price + tax  # Accumulates error

# GOOD
from decimal import Decimal
price = Decimal('19.99')
tax = price * Decimal('0.08')
```

AI rarely uses `Decimal` for money or epsilon comparisons for floating-point equality. Financial bugs accumulate silently.

### Date and Time Bugs

Common AI-generated time bugs:
- Treating all times as UTC or local without being explicit
- Adding "1 month" to January 31 (undefined result)
- Assuming 24 hours in every day (DST breaks this)
- Using `YYYY` (week-year) instead of `yyyy` (calendar year) in Java formatters
- Comparing dates as strings instead of timestamps

### Incorrect Async Patterns

```javascript
// Looks clean but runs sequentially, not in parallel
const user = await getUser(id)
const orders = await getOrders(id)
const profile = await getProfile(id)

// Should be parallel
const [user, orders, profile] = await Promise.all([
  getUser(id), getOrders(id), getProfile(id)
])
```

Also: missing `await` keywords (returns a Promise instead of the value), `async` functions that never await, and unhandled rejections.

### Race Conditions in Async Code

```javascript
// Looks clean, breaks under concurrent calls
let cache = {}
async function getData(key) {
  if (!cache[key]) {
    cache[key] = await fetchFromDB(key)  // Two callers both fetch
  }
  return cache[key]
}
```

Clean async/await syntax masks the fact that multiple callers can enter the check simultaneously.

## Comment Anti-Patterns (Additional)

### Apologetic Comments

A distinctly AI tell -- comments that apologize for the code:

```python
# Note: This is a simplified implementation and may need
# to be enhanced for production use cases.
```

Human developers do not apologize in comments for code they wrote.

### Banner/Divider Comments

```python
# ============================================
# UTILITY FUNCTIONS
# ============================================
```

Visual noise from 1990s-era training data. Modern code does not need ASCII-art section dividers.

### Language Feature Explanations

```python
# Use a dictionary comprehension to create a mapping
mapping = {k: v for k, v in items}
```

Comments that explain language syntax rather than business logic. The reader knows Python; they need to know *why* this mapping exists.

## Backend Anti-Patterns

### N+1 Queries

```python
# BAD (one query per user in the loop)
users = User.objects.all()
for user in users:
    orders = Order.objects.filter(user=user)  # N queries

# GOOD (one query with join)
users = User.objects.prefetch_related('orders').all()
```

AI generates loops that issue a database query per iteration. Use joins, prefetch, eager loading, or batch queries.

### Missing Timeouts on HTTP Calls

```python
# BAD (hangs forever if service is down)
response = requests.get(url)

# GOOD
response = requests.get(url, timeout=10)
```

Every external HTTP call needs a timeout. Without one, a stalled downstream service blocks your threads indefinitely.

### Naive Retry Logic

```python
# BAD (immediate retries amplify failures)
for attempt in range(5):
    try:
        return call_service()
    except Exception:
        pass  # Retry immediately

# GOOD (exponential backoff with jitter)
for attempt in range(5):
    try:
        return call_service()
    except TransientError:
        sleep(2 ** attempt + random.uniform(0, 1))
```

### Unbounded Queries

```python
# BAD (returns the entire table)
all_users = User.objects.all()

# GOOD
page = User.objects.all()[:100]  # Paginate
```

List endpoints and queries need LIMIT/pagination. An unbounded `.all()` on a million-row table will crash the service.
