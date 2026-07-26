---
name: next-cache-components
description: Next.js 16+ Cache Components for Partial Prerendering (PPR) — use cache directive, cacheLife, cacheTag, updateTag. Use when working with Next.js caching, PPR, or migrating from unstable_cache.
---

# Cache Components (Next.js 16+)

Cache Components enable Partial Prerendering (PPR) — mix static, cached, and dynamic content in a single route.

## Enable Cache Components

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

This replaces the old `experimental.ppr` flag.

---

## Three Content Types

With Cache Components enabled, content falls into three categories:

### 1. Static (Auto-Prerendered)

Synchronous code, imports, pure computations — prerendered at build time:

```tsx
export default function Page() {
  return (
    <header>
      <h1>Our Blog</h1>
      <nav>...</nav>
    </header>
  )
}
```

### 2. Cached (`use cache`)

Async data that doesn't need fresh fetches every request:

```tsx
async function BlogPosts() {
  'use cache'
  cacheLife('hours')

  const posts = await db.posts.findMany()
  return <PostList posts={posts} />
}
```

### 3. Dynamic (Suspense)

Runtime data that must be fresh — wrap in `<Suspense>`:

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <>
      <BlogPosts />  {/* Cached */}
      <Suspense fallback={<p>Loading...</p>}>
        <UserPreferences />  {/* Dynamic — streams in */}
      </Suspense>
    </>
  )
}

async function UserPreferences() {
  const theme = (await cookies()).get('theme')?.value
  return <p>Theme: {theme}</p>
}
```

---

## `use cache` Directive

### File Level

```tsx
'use cache'

export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}
```

### Component Level

```tsx
export async function CachedComponent() {
  'use cache'
  const data = await fetchData()
  return <div>{data}</div>
}
```

### Function Level

```tsx
export async function getData() {
  'use cache'
  return db.query('SELECT * FROM posts')
}
```

---

## Cache Profiles

### Built-in Profiles

```tsx
'use cache'                  // Default: 5m stale, 15m revalidate
'use cache: remote'          // Platform-provided cache (Redis, KV)
'use cache: private'         // For compliance — allows runtime APIs
```

### `cacheLife()` — Custom Lifetime

```tsx
import { cacheLife } from 'next/cache'

async function getData() {
  'use cache'
  cacheLife('hours')  // Built-in profile
  return fetch('/api/data')
}
```

Built-in profiles: `'default'`, `'minutes'`, `'hours'`, `'days'`, `'weeks'`, `'max'`

### Inline Configuration

```tsx
async function getData() {
  'use cache'
  cacheLife({
    stale: 3600,      // 1 hour — serve stale while revalidating
    revalidate: 7200, // 2 hours — background revalidation interval
    expire: 86400,    // 1 day — hard expiration
  })
  return fetch('/api/data')
}
```

---

## Cache Invalidation

### `cacheTag()` — Tag Cached Content

```tsx
import { cacheTag } from 'next/cache'

async function getProducts() {
  'use cache'
  cacheTag('products')
  return db.products.findMany()
}

async function getProduct(id: string) {
  'use cache'
  cacheTag('products', `product-${id}`)
  return db.products.findUnique({ where: { id } })
}
```

### `updateTag()` — Immediate Invalidation

Use when the cache must be refreshed within the same request:

```tsx
'use server'
import { updateTag } from 'next/cache'

export async function updateProduct(id: string, data: FormData) {
  await db.products.update({ where: { id }, data })
  updateTag(`product-${id}`)  // Immediate — same request sees fresh data
}
```

### `revalidateTag()` — Background Revalidation

Use for stale-while-revalidate behavior:

```tsx
'use server'
import { revalidateTag } from 'next/cache'

export async function createPost(data: FormData) {
  await db.posts.create({ data })
  revalidateTag('posts')  // Background — next request sees fresh data
}
```

---

## Runtime Data Constraint

**Cannot** access `cookies()`, `headers()`, or `searchParams` inside `use cache`.

### Solution: Pass as Arguments

```tsx
// Wrong — runtime API inside use cache
async function CachedProfile() {
  'use cache'
  const session = (await cookies()).get('session')?.value  // Error!
  return <div>{session}</div>
}

// Correct — extract outside, pass as argument
async function ProfilePage() {
  const session = (await cookies()).get('session')?.value
  return <CachedProfile sessionId={session} />
}

async function CachedProfile({ sessionId }: { sessionId: string }) {
  'use cache'
  // sessionId becomes part of cache key automatically
  const data = await fetchUserData(sessionId)
  return <div>{data.name}</div>
}
```

### Exception: `use cache: private`

For compliance requirements when you can't refactor:

```tsx
async function getData() {
  'use cache: private'
  const session = (await cookies()).get('session')?.value  // Allowed
  return fetchData(session)
}
```

---

## Cache Key Generation

Cache keys are automatic based on:
- **Build ID** — invalidates all caches on deploy
- **Function ID** — hash of function location in the source
- **Serializable arguments** — props become part of key
- **Closure variables** — outer scope values included

```tsx
async function Component({ userId }: { userId: string }) {
  const getData = async (filter: string) => {
    'use cache'
    // Cache key = userId (closure) + filter (argument)
    return fetch(`/api/users/${userId}?filter=${filter}`)
  }
  return getData('active')
}
```

---

## Complete Example

```tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'

export default function DashboardPage() {
  return (
    <>
      <header><h1>Dashboard</h1></header>
      <nav>...</nav>
      <Stats />
      <Suspense fallback={<NotificationsSkeleton />}>
        <Notifications />
      </Suspense>
    </>
  )
}

async function Stats() {
  'use cache'
  cacheLife('hours')
  cacheTag('dashboard-stats')

  const stats = await db.stats.aggregate()
  return <StatsDisplay stats={stats} />
}

async function Notifications() {
  const userId = (await cookies()).get('userId')?.value
  const notifications = await db.notifications.findMany({
    where: { userId, read: false },
  })
  return <NotificationList items={notifications} />
}
```

---

## Migration from Previous Versions

| Old Config | Replacement |
|---|---|
| `experimental.ppr` | `cacheComponents: true` |
| `dynamic = 'force-dynamic'` | Remove (default behavior) |
| `dynamic = 'force-static'` | `'use cache'` + `cacheLife('max')` |
| `revalidate = N` | `cacheLife({ revalidate: N })` |
| `unstable_cache()` | `'use cache'` directive |

### Migrating `unstable_cache` → `use cache`

**Before:**
```tsx
import { unstable_cache } from 'next/cache'

const getCachedUser = unstable_cache(
  async (id) => getUser(id),
  ['my-app-user'],
  { tags: ['users'], revalidate: 60 }
)
```

**After:**
```tsx
import { cacheLife, cacheTag } from 'next/cache'

async function getCachedUser(id: string) {
  'use cache'
  cacheTag('users')
  cacheLife({ revalidate: 60 })
  return getUser(id)
}
```

Key differences:
- No manual cache keys — `use cache` generates keys from function arguments and closures
- Replace `options.tags` with `cacheTag()` calls inside the function
- Replace `options.revalidate` with `cacheLife({ revalidate: N })` or a built-in profile

---

## Limitations

- Edge runtime not supported — requires Node.js
- Static export (`output: 'export'`) not supported — needs server
- Non-deterministic values (`Math.random()`, `Date.now()`) execute once at build time inside `use cache`

For request-time randomness:
```tsx
import { connection } from 'next/server'

async function DynamicContent() {
  await connection()  // Defer to request time
  const id = crypto.randomUUID()
  return <div>{id}</div>
}
```

---

_Adapted from [vercel/next.js](https://github.com/vercel/next.js/tree/canary/skills) (Next.js agent skills by Vercel), MIT License. See the repository for full license text._
