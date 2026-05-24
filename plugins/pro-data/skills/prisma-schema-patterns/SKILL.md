---
name: prisma-schema-patterns
description: Prisma ORM schema design, type-safe query patterns, and migration workflow. Use when setting up database access with Prisma, defining data models, managing migrations, or optimizing database queries.
---

# Prisma Schema Patterns

## Core Principle

**TYPE-SAFE DATABASE ACCESS** — Prisma generates TypeScript types from your schema. Use them everywhere.

## Installation

```bash
npm install @prisma/client
npm install -D prisma
npx prisma init
```

## Schema Definition

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  sessions  Session[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([role])
}

model Profile {
  id     String  @id @default(cuid())
  bio    String? @db.Text
  avatar String?
  userId String  @unique
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Post {
  id        String     @id @default(cuid())
  title     String
  slug      String     @unique
  content   String?    @db.Text
  published Boolean    @default(false)
  authorId  String
  author    User       @relation(fields: [authorId], references: [id], onDelete: Cascade)
  tags      Tag[]
  comments  Comment[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([authorId])
  @@index([slug])
  @@index([published, createdAt])
}

model Tag {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]
}

model Comment {
  id        String   @id @default(cuid())
  content   String   @db.Text
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorId  String
  createdAt DateTime @default(now())

  @@index([postId])
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

enum Role {
  USER
  MODERATOR
  ADMIN
}
```

## Client Setup

```typescript
// src/db/client.ts
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}
```

## Query Patterns

### Basic CRUD

```typescript
// Create
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'User',
    password: hashedPassword,
  },
});

// Read with condition
const users = await prisma.user.findMany({
  where: { role: 'USER' },
  orderBy: { createdAt: 'desc' },
  take: 10,
});

// Update
const updated = await prisma.user.update({
  where: { id: userId },
  data: { name: 'New Name' },
});

// Delete
await prisma.user.delete({
  where: { id: userId },
});
```

### Relations

```typescript
// Create with relations
const post = await prisma.post.create({
  data: {
    title: 'My Post',
    slug: 'my-post',
    content: 'Content here',
    author: {
      connect: { id: userId },
    },
    tags: {
      connectOrCreate: [
        {
          where: { name: 'typescript' },
          create: { name: 'typescript' },
        },
      ],
    },
  },
});

// Include relations
const postWithAuthor = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    author: {
      select: { id: true, name: true, email: true },
    },
    tags: true,
    _count: {
      select: { comments: true },
    },
  },
});
```

### Pagination

```typescript
async function paginateUsers(page: number, perPage: number) {
  const skip = (page - 1) * perPage;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ]);

  return {
    data: users,
    meta: {
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    },
  };
}
```

### Transactions

```typescript
// Interactive transaction
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const post = await tx.post.create({
    data: {
      title: 'New Post',
      slug: 'new-post',
      authorId: user.id,
    },
  });

  return { user, post };
});
```

## Migration Commands

```bash
# Create migration (dev)
npx prisma migrate dev --name add_users

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate

# Push schema without migration file (prototyping only)
npx prisma db push

# Open visual browser
npx prisma studio
```

## Best Practices

1. **Use transactions** for related operations that must succeed or fail together
2. **Index foreign keys** — always add `@@index` on foreign key fields
3. **Select only needed fields** — use `select` for performance, avoid `include` for large datasets
4. **Avoid N+1** — use `include` for relations rather than multiple queries in a loop
5. **Soft deletes** — add `deletedAt DateTime?` for audit trails
6. **Connection pooling** — use PgBouncer or Prisma Accelerate in production
7. **Always use `prisma migrate deploy`** in production, never `prisma db push`

## Notes

- Run `prisma generate` after every schema change
- Use `prisma studio` for database exploration in development
- Migrations are production-safe and tracked in version control

---

_Forked from [IvanTorresEdge/molcajete.ai](https://github.com/IvanTorresEdge/molcajete.ai) — MIT. See original repository for full license text._
