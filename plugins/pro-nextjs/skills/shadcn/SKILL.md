---
name: shadcn
description: shadcn/ui reference for Next.js — installation, component usage, theming, and composition patterns with the App Router.
---

# shadcn/ui with Next.js

shadcn/ui is not a component library you install as a dependency. It is a collection of copy-owned components — each component is added to your project source (`components/ui/`) where you own and edit it directly.

## Installation

```bash
npx shadcn@latest init
```

Prompts: style (New York or Default), base color, CSS variables for theming. Writes `components.json` to the project root and adds the `cn` utility (`lib/utils.ts`).

For a fully non-interactive init:

```bash
npx shadcn@latest init -d   # defaults: New York, Zinc, CSS vars on
```

## Adding components

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog card badge   # multiple at once
npx shadcn@latest add --all               # entire registry (rarely needed)
```

Components land in `components/ui/<name>.tsx`. Dependencies (Radix primitives, etc.) are added to `package.json` automatically.

To update a component to the latest registry version:

```bash
npx shadcn@latest add button --overwrite
```

## components.json

Key fields:

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- `rsc: true` — components are Server Component-compatible where possible. Client-only components get `"use client"` automatically.
- `prefix` — optional Tailwind class prefix (e.g. `"tw-"`) for projects that need to isolate Tailwind.

## Theming

shadcn/ui uses CSS variables mapped from `globals.css` into Tailwind via `hsl()` values. The active theme lives in `:root` and `.dark`.

```css
/* globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    /* ... */
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
  }
}
```

To switch themes, replace the variable values — no Tailwind config change needed.

**Preset themes:** browse and copy from [ui.shadcn.com/themes](https://ui.shadcn.com/themes).

Dark mode with `next-themes`:

```bash
npm install next-themes
```

```tsx
// app/providers.tsx
'use client'
import { ThemeProvider } from 'next-themes'
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}</ThemeProvider>
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers'
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><Providers>{children}</Providers></body>
    </html>
  )
}
```

## Component patterns

### Composition over configuration

shadcn components expose their sub-parts as named exports. Compose them explicitly:

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function ProductCard({ name, price }: { name: string; price: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent>${price}</CardContent>
    </Card>
  )
}
```

### Extending with `cn`

`cn` is a `clsx` + `tailwind-merge` wrapper. Use it to merge conditional classes without conflicts:

```tsx
import { cn } from '@/lib/utils'

<Button className={cn('w-full', isLoading && 'opacity-50 cursor-not-allowed')}>
  Submit
</Button>
```

### Server vs Client components

Most shadcn primitives (Card, Badge, Separator) are pure markup — usable in Server Components with no directive. Interactive components (Dialog, Dropdown, Sheet, Command) include `"use client"` and must live in Client Components or be wrapped in one.

Pattern for passing Server Component data into a client shell:

```tsx
// app/page.tsx (Server Component)
import { UserMenu } from '@/components/user-menu'
export default async function Page() {
  const user = await getUser()
  return <UserMenu user={user} />
}

// components/user-menu.tsx
'use client'
import { DropdownMenu, ... } from '@/components/ui/dropdown-menu'
export function UserMenu({ user }) { ... }
```

### Forms with react-hook-form + zod

```bash
npx shadcn@latest add form
npm install react-hook-form zod @hookform/resolvers
```

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const schema = z.object({ email: z.string().email() })

export function EmailForm() {
  const form = useForm({ resolver: zodResolver(schema) })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(console.log)}>
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

## Data table

```bash
npx shadcn@latest add table
npm install @tanstack/react-table
```

Use `useReactTable` from `@tanstack/react-table` with `getCoreRowModel`, `getSortedRowModel`, and `getPaginationRowModel`. The `DataTable` component lives in `components/ui/data-table.tsx` and is a Client Component.

## Common pitfalls

- **Don't `npm install @shadcn/ui`** — there is no such package. The CLI copies source files.
- **Hydration mismatch with dialogs** — wrap in `<Suspense>` if rendered server-side and toggled on mount.
- **Radix portal rendering** — `Dialog`, `Sheet`, `Popover` render into a portal outside the Next.js tree. This is expected; don't add `z-index` hacks to the trigger.
- **Updating components** — re-running `add` with `--overwrite` replaces local edits. Keep customizations minimal or track them in git before overwriting.

---

_Reference: [ui.shadcn.com/docs](https://ui.shadcn.com/docs)_
