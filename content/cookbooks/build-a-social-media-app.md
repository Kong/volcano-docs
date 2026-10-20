---
title: Build a social media app
description: Create a social app from scratch with accounts, posts, comments, friendships, private messages, and realtime updates on Volcano.
tags: [authentication, database, realtime, app-design]
---

Build a social community anyone can sign up for to share posts, comment, make friends, and send direct messages.
Start with an empty folder and create a Next.js application backed by Volcano Auth, PostgreSQL, and Realtime.
You do not need an existing application or access to another repository.

The finished app includes a searchable feed, profiles, likes, private bookmarks, friend requests, private messages with read receipts, and in-app notifications.
Anyone can create an account and choose a display name to join immediately.
Photos, groups, online presence, and email notifications are extensions beyond this text-based version.

Each step includes the code for the files it introduces.
Create the application in a separate directory and copy each example into the indicated filename.

## 1. Create the application folder

Install Node.js 24 or later and the [Volcano CLI](/get-started/install), then create an empty project:

```bash
mkdir community
cd community
mkdir -p src/app src/components src/lib scripts tests volcano
```

Create these configuration files using the examples below:

| Local filename | Contents | Purpose |
| --- | --- | --- |
| `package.json` | Package definition (example below) | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration (example below) | Strict type checking |
| `next.config.mjs` | Next.js configuration (example below) | Standalone project root |
| `.gitignore` | Ignore rules (example below) | Exclude credentials and build output |
| `.env.example` | Environment template (example below) | Document frontend variables |

Install dependencies:

```bash
npm install
cp .env.example .env.local
```

**Checkpoint:** `node --version` reports version 24 or newer, and `npm install` completes.
Keep the generated `package-lock.json` to reproduce the installation with `npm ci` later.
This tutorial pins Next.js `16.3.8`, React `19.2.3`, and `@volcano.dev/sdk` `2.0.1`.

**`package.json`**

```json title="package.json"
{
  "name": "volcano-social-app",
  "version": "1.0.0",
  "private": true,
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "next typegen && tsc --noEmit",
    "db:files": "node scripts/write-migrations.mjs",
    "test": "node --test tests/*.test.mjs"
  },
  "dependencies": {
    "@volcano.dev/sdk": "2.0.1",
    "next": "16.3.8",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@electric-sql/pglite": "0.5.10",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.9.3"
  }
}
```


**`tsconfig.json`**

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2018",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "plugins": [
      {
        "name": "next"
      }
    ],
    "incremental": true,
    "allowJs": true
  },
  "include": [
    "next-env.d.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```


**`next.config.mjs`**

```javascript title="next.config.mjs"
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const nextConfig = { agentRules: false, turbopack: { root }, outputFileTracingRoot: root };
export default nextConfig;
```


**`.gitignore`**

```text title=".gitignore"
node_modules/
.next/
.env*
!.env.example
next-env.d.ts
*.tsbuildinfo
volcano/*.env
```


**`.env.example`**

```dotenv title=".env.example"
NEXT_PUBLIC_VOLCANO_API_URL=https://api.volcano.dev
NEXT_PUBLIC_VOLCANO_ANON_KEY=ak-your-project-key
NEXT_PUBLIC_VOLCANO_DATABASE=community
```


## 2. Create a Volcano project

Sign in with your Volcano developer account, create a project for this application, and add a database:

```bash
volcano login
volcano projects create community-demo
volcano use community-demo
volcano cloud databases create community
```

If the project name is taken, choose another name in both project commands.
These commands create cloud resources; the frontend will run on your computer against this cloud database.

In the project's authentication settings, enable email/password signup and allow the exact browser origin `http://localhost:3000`.
Leave signup email-domain restrictions empty so anyone can register.
The default anonymous key is auth-only and cannot connect to realtime.
Create a publishable anonymous key using [Creating a key with custom permissions](/platform/authentication/security/anon-keys#creating-a-key-with-custom-permissions).
Include all seven auth permissions (`auth.signup`, `auth.signin`, `auth.refresh`, `auth.logout`, `auth.password_reset`, `auth.confirm_email`, and `auth.resend_confirmation`), plus `realtime.connect` and `realtime.subscribe`.
Use this new key in `.env.local` below.
See [authentication configuration](/platform/authentication/configuring-auth-methods) and [realtime authentication](/sdk/js/realtime).

Edit `.env.local`:

```dotenv
NEXT_PUBLIC_VOLCANO_API_URL=https://api.volcano.dev
NEXT_PUBLIC_VOLCANO_ANON_KEY=ak-your-project-key
NEXT_PUBLIC_VOLCANO_DATABASE=community
```

Replace `ak-your-project-key` with the new project's anonymous key.
The database name must match the one you created.
This app uses no frontend service key; database permissions determine what each authenticated user can do.

**Checkpoint:** the dashboard shows the `community` database in your new project, and `.env.local` contains that project's anonymous key.

## 3. Create the database tables and permissions

Create `scripts/write-migrations.mjs` from the migration generator (example below).
It contains the complete schema, grants, row-level security policies, and triggers.
Generate and apply its numbered SQL files:

```bash
npm run db:files
volcano cloud databases migration up --all --database community
```

The generator produces one SQL statement per file under `volcano/migrations/`.
The CLI runs them in filename order and does not track applied files.
The supplied statements support rerunning the same initial setup in a fresh database.
Rerunning `CREATE TABLE IF NOT EXISTS` does not upgrade an older schema; changes to existing tables and policies require explicit new migrations.

| Table | Stores | Access rule |
| --- | --- | --- |
| `community_members` | Account ID, display name, bio, active status | Anyone can create their own profile; members see active profiles |
| `community_accounts` | Account ID and login email binding | Database helpers and triggers only; browsers have no access |
| `community_posts` | Posts and reaction counts | Members read; authors edit and delete |
| `community_comments` | Replies | Members read; authors create and delete their replies |
| `community_likes` | One like per member and post | Members manage their own likes |
| `community_bookmarks` | Saved posts | Only the member who saved them reads or removes them |
| `community_friendships` | Pending and accepted connections | Participants read; only the recipient accepts |
| `community_messages` | Message history and read state | Active accepted friends read their conversation; only the recipient marks read |
| `community_notifications` | Friend and comment notifications | Only the recipient reads and marks them read |
| `community_inboxes` | An identity and version counter | Each user reads only their own signal row |

Community data is available after signin and profile creation.
The authenticated ID and email must match the private account binding for an active profile:

```sql
SELECT EXISTS (
  SELECT 1 FROM public.community_members AS m
  JOIN public.community_accounts AS a ON a.user_id = m.id
  WHERE m.id = auth.uid()
    AND a.email = lower(auth.email())
    AND m.active
);
```

The migration wraps this check in a scoped `SECURITY DEFINER` helper to avoid recursive member-table policies.
Column grants restrict client writes; defaults supply the authenticated author, and triggers maintain counts and notifications.
New profiles are active by default.
Clients cannot change their active status, choose another author, forge notification recipients, or overwrite counts.

The database keeps login emails in `community_accounts`, which grants no access to browser roles.
Public profile queries contain no email field; the interface uses Volcano Auth's `user.email` only for the signed-in account.

**Checkpoint:** migrations complete, and the SQL console shows ten `community_` tables with row-level security enabled.

**`scripts/write-migrations.mjs`**

```javascript title="scripts/write-migrations.mjs"
import fs from 'node:fs';

// Each item becomes exactly one SQL statement in its own numbered file.
export const statements = [
  ['members', `CREATE TABLE IF NOT EXISTS public.community_members (
    id uuid PRIMARY KEY DEFAULT auth.uid(),
    display_name text NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 80),
    bio text NOT NULL DEFAULT '' CHECK(length(bio)<=500), active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  );`],
  ['accounts', `CREATE TABLE IF NOT EXISTS public.community_accounts (
    user_id uuid PRIMARY KEY REFERENCES public.community_members(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE
  );`],
  ['inboxes', `CREATE TABLE IF NOT EXISTS public.community_inboxes (id uuid PRIMARY KEY REFERENCES public.community_members(id) ON DELETE CASCADE, version bigint NOT NULL DEFAULT 0);`],
  ['posts', `CREATE TABLE IF NOT EXISTS public.community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.community_members(id),
    body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 4000), like_count integer NOT NULL DEFAULT 0,
    comment_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
  );`],
  ['comments', `CREATE TABLE IF NOT EXISTS public.community_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.community_members(id),
    body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000), created_at timestamptz NOT NULL DEFAULT now()
  );`],
  ['likes', `CREATE TABLE IF NOT EXISTS public.community_likes (
    post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.community_members(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(post_id,user_id)
  );`],
  ['bookmarks', `CREATE TABLE IF NOT EXISTS public.community_bookmarks (
    post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.community_members(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(post_id,user_id)
  );`],
  ['friendships', `CREATE TABLE IF NOT EXISTS public.community_friendships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.community_members(id),
    recipient_id uuid NOT NULL REFERENCES public.community_members(id), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
    created_at timestamptz NOT NULL DEFAULT now(), CHECK(requester_id<>recipient_id)
  );`],
  ['friend_pair', `CREATE UNIQUE INDEX IF NOT EXISTS community_friend_pair ON public.community_friendships(least(requester_id,recipient_id),greatest(requester_id,recipient_id));`],
  ['messages', `CREATE TABLE IF NOT EXISTS public.community_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sequence bigserial UNIQUE,
    sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.community_members(id), recipient_id uuid NOT NULL REFERENCES public.community_members(id),
    body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000), is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(), CHECK(sender_id<>recipient_id)
  );`],
  ['notifications', `CREATE TABLE IF NOT EXISTS public.community_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id uuid NOT NULL REFERENCES public.community_members(id),
    title text NOT NULL, is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
  );`],
  ['is_member', `CREATE OR REPLACE FUNCTION public.community_is_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
    SELECT EXISTS(SELECT 1 FROM public.community_members m
      JOIN public.community_accounts a ON a.user_id=m.id
      WHERE m.id=auth.uid() AND a.email=lower(auth.email()) AND m.active);
  $$;`],
  ['are_friends', `CREATE OR REPLACE FUNCTION public.community_are_friends(a uuid,b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
    SELECT auth.uid() IN (a,b) AND EXISTS(SELECT 1 FROM public.community_friendships f
      JOIN public.community_members x ON x.id=a AND x.active JOIN public.community_members y ON y.id=b AND y.active
      WHERE f.status='accepted' AND least(f.requester_id,f.recipient_id)=least(a,b) AND greatest(f.requester_id,f.recipient_id)=greatest(a,b));
  $$;`],
];

const tables = ['members','accounts','inboxes','posts','comments','likes','bookmarks','friendships','messages','notifications'];
for (const table of tables) {
  statements.push([`${table}_rls`, `ALTER TABLE public.community_${table} ENABLE ROW LEVEL SECURITY;`]);
  statements.push([`${table}_revoke`, `REVOKE ALL ON public.community_${table} FROM PUBLIC,anon,authenticated;`]);
}

function policy(name, table, operation, clause) {
  statements.push([name, `DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_${table}' AND policyname='${name}') THEN
    CREATE POLICY ${name} ON public.community_${table} FOR ${operation} TO authenticated ${clause}; END IF; END $$;`]);
}
const member = 'public.community_is_member()';
const mine = "id=auth.uid()";
policy('member_read','members','SELECT',`USING((${mine}) OR (active AND ${member}))`);
policy('member_join','members','INSERT',`WITH CHECK(${mine} AND active)`);
policy('member_edit','members','UPDATE',`USING(${mine} AND ${member}) WITH CHECK(${mine} AND ${member})`);
policy('inbox_read','inboxes','SELECT','USING(id=auth.uid())');
for (const table of ['posts','comments']) {
  policy(`${table}_read`,table,'SELECT',`USING(${member})`);
  policy(`${table}_create`,table,'INSERT',`WITH CHECK(${member} AND author_id=auth.uid())`);
  policy(`${table}_delete`,table,'DELETE',`USING(${member} AND author_id=auth.uid())`);
}
policy('posts_edit','posts','UPDATE',`USING(${member} AND author_id=auth.uid()) WITH CHECK(${member} AND author_id=auth.uid())`);
for (const table of ['likes','bookmarks']) {
  policy(`${table}_read`,table,'SELECT',`USING(${member} AND user_id=auth.uid())`);
  policy(`${table}_create`,table,'INSERT',`WITH CHECK(${member} AND user_id=auth.uid())`);
  policy(`${table}_delete`,table,'DELETE',`USING(${member} AND user_id=auth.uid())`);
}
const participant = 'auth.uid() IN (requester_id,recipient_id)';
policy('friend_read','friendships','SELECT',`USING(${member} AND ${participant})`);
policy('friend_request','friendships','INSERT',`WITH CHECK(${member} AND requester_id=auth.uid() AND status='pending' AND EXISTS(SELECT 1 FROM public.community_members WHERE id=recipient_id AND active))`);
policy('friend_accept','friendships','UPDATE',`USING(${member} AND recipient_id=auth.uid() AND status='pending') WITH CHECK(${member} AND recipient_id=auth.uid() AND status='accepted')`);
policy('friend_remove','friendships','DELETE',`USING(${member} AND ${participant})`);
const conversation = `${member} AND public.community_are_friends(sender_id,recipient_id)`;
policy('message_read','messages','SELECT',`USING(${conversation} AND auth.uid() IN(sender_id,recipient_id))`);
policy('message_send','messages','INSERT',`WITH CHECK(${conversation} AND sender_id=auth.uid() AND NOT is_read)`);
policy('message_receipt','messages','UPDATE',`USING(${conversation} AND recipient_id=auth.uid()) WITH CHECK(${conversation} AND recipient_id=auth.uid() AND is_read)`);
policy('notification_read','notifications','SELECT',`USING(${member} AND recipient_id=auth.uid())`);
policy('notification_receipt','notifications','UPDATE',`USING(${member} AND recipient_id=auth.uid()) WITH CHECK(${member} AND recipient_id=auth.uid() AND is_read)`);

for (const table of tables) {
  if (table === 'accounts') continue;
  statements.push([`${table}_select`, `GRANT SELECT ON public.community_${table} TO authenticated;`]);
}
for (const [table, columns] of [
  ['members','display_name'], ['posts','body'], ['comments','post_id,body'], ['likes','post_id'],
  ['bookmarks','post_id'], ['friendships','recipient_id'], ['messages','id,recipient_id,body'],
]) statements.push([`${table}_insert`, `GRANT INSERT(${columns}) ON public.community_${table} TO authenticated;`]);
for (const [table, columns] of [['members','display_name,bio'],['posts','body'],['friendships','status'],['messages','is_read'],['notifications','is_read']]) {
  statements.push([`${table}_update`, `GRANT UPDATE(${columns}) ON public.community_${table} TO authenticated;`]);
}
for (const table of ['posts','comments','likes','bookmarks','friendships']) statements.push([`${table}_delete_grant`, `GRANT DELETE ON public.community_${table} TO authenticated;`]);
statements.push(['message_sequence', 'GRANT USAGE ON SEQUENCE public.community_messages_sequence_seq TO authenticated;']);

// Triggers run as the database owner. Clients never write counts, inbox versions,
// or notification recipients. Private events signal only their two participants.
statements.push(['signal_function', `CREATE OR REPLACE FUNCTION public.community_signal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r jsonb; target uuid; BEGIN
  IF TG_OP='DELETE' THEN r=to_jsonb(OLD); ELSE r=to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME='community_members' THEN
    IF TG_OP='INSERT' THEN
      INSERT INTO public.community_accounts(user_id,email) VALUES(NEW.id,lower(auth.email()));
      INSERT INTO public.community_inboxes(id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
    END IF;
    UPDATE public.community_inboxes SET version=version+1 WHERE id IN(SELECT id FROM public.community_members WHERE active) OR id=(r->>'id')::uuid;
  ELSIF TG_TABLE_NAME IN('community_posts','community_comments','community_likes') THEN
    UPDATE public.community_inboxes SET version=version+1 WHERE id IN(SELECT id FROM public.community_members WHERE active);
  ELSIF TG_TABLE_NAME='community_friendships' THEN
    UPDATE public.community_inboxes SET version=version+1 WHERE id IN((r->>'requester_id')::uuid,(r->>'recipient_id')::uuid);
    IF TG_OP='INSERT' THEN INSERT INTO public.community_notifications(recipient_id,title) VALUES(NEW.recipient_id,'You received a friend request.');
    ELSIF TG_OP='UPDATE' AND OLD.status='pending' AND NEW.status='accepted' THEN INSERT INTO public.community_notifications(recipient_id,title) VALUES(NEW.requester_id,'Your friend request was accepted.'); END IF;
  ELSIF TG_TABLE_NAME='community_messages' THEN
    UPDATE public.community_inboxes SET version=version+1 WHERE id IN((r->>'sender_id')::uuid,(r->>'recipient_id')::uuid);
  ELSIF TG_TABLE_NAME='community_notifications' THEN
    UPDATE public.community_inboxes SET version=version+1 WHERE id=(r->>'recipient_id')::uuid;
  END IF;
  RETURN NULL;
END $$;`]);
statements.push(['count_function', `CREATE OR REPLACE FUNCTION public.community_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target uuid; delta integer; recipient uuid; BEGIN
  IF TG_OP='DELETE' THEN target=OLD.post_id; delta=-1; ELSE target=NEW.post_id; delta=1; END IF;
  IF TG_TABLE_NAME='community_likes' THEN UPDATE public.community_posts SET like_count=greatest(0,like_count+delta) WHERE id=target;
  ELSE
    UPDATE public.community_posts SET comment_count=greatest(0,comment_count+delta) WHERE id=target;
    IF TG_OP='INSERT' THEN
      SELECT author_id INTO recipient FROM public.community_posts WHERE id=target;
      IF recipient IS NOT NULL AND recipient<>NEW.author_id THEN INSERT INTO public.community_notifications(recipient_id,title) VALUES(recipient,'Someone commented on your post.'); END IF;
    END IF;
  END IF;
  RETURN NULL;
END $$;`]);

function trigger(name, table, events, fn) {
  statements.push([name, `DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='${name}') THEN
    CREATE TRIGGER ${name} AFTER ${events} ON public.community_${table} FOR EACH ROW EXECUTE FUNCTION public.${fn}(); END IF; END $$;`]);
}
for (const table of ['members','posts','comments','likes','friendships','messages','notifications']) trigger(`community_${table}_signal`,table,'INSERT OR UPDATE OR DELETE','community_signal');
for (const table of ['likes','comments']) trigger(`community_${table}_count`,table,'INSERT OR DELETE','community_count');
for (const signature of ['community_is_member()','community_are_friends(uuid,uuid)','community_signal()','community_count()']) {
  const name = signature.split('(')[0];
  statements.push([`${name}_revoke`, `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC,anon,authenticated;`]);
  if (name === 'community_is_member' || name === 'community_are_friends') statements.push([`${name}_grant`, `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`]);
}
for (const [name, table, columns] of [
  ['feed','posts','created_at DESC,id DESC'],['comments','comments','post_id,created_at,id'],
  ['conversation','messages','sender_id,recipient_id,sequence DESC'],['notifications','notifications','recipient_id,created_at DESC,id DESC'],
]) statements.push([`${name}_index`, `CREATE INDEX IF NOT EXISTS community_${name}_idx ON public.community_${table}(${columns});`]);

export function writeMigrations(directory = new URL('../volcano/migrations/', import.meta.url)) {
  fs.mkdirSync(directory, { recursive: true });
  statements.forEach(function write([name, sql], index) {
    const filename = `${String(index + 1).padStart(3, '0')}_${name}.sql`;
    fs.writeFileSync(new URL(filename, directory), `${sql.trim()}\n`);
  });
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  writeMigrations();
  console.log(`Wrote ${statements.length} single-statement migrations.`);
}
```


## 4. Connect the browser to Volcano

Create these files:

| Local filename | Contents |
| --- | --- |
| `src/lib/volcano.ts` | Shared SDK client (example below) |
| `src/lib/types.ts` | Application record types (example below) |
| `src/lib/data.ts` | Queries and message submission (example below) |

The client is created lazily and reused across features:

```typescript
import { VolcanoClient } from '@volcano.dev/sdk';

const client = new VolcanoClient({
  apiUrl: process.env.NEXT_PUBLIC_VOLCANO_API_URL,
  anonKey: process.env.NEXT_PUBLIC_VOLCANO_ANON_KEY,
});
client.database(process.env.NEXT_PUBLIC_VOLCANO_DATABASE!);
```

The complete client example below includes configuration validation and singleton handling.
The application initializes the SDK before loading account data and listens for authentication changes.
All queries use the authenticated client, so PostgreSQL applies the current user's policies.

`data.ts` supplies feed search, 20-record pages for posts, comments, people, and messages, plus author, bookmark, and friendship queries.
It sorts posts by creation time and ID for stable ordering.
Paginated queries request 21 rows, display the first 20, and use the extra row to enable the next-page action.
Saved posts remain separate from feed search.

**`src/lib/volcano.ts`**

```typescript title="src/lib/volcano.ts"
import { VolcanoClient } from '@volcano.dev/sdk';

let client: VolcanoClient | undefined;

export function getVolcano() {
  if (!client) {
    const anonKey = process.env.NEXT_PUBLIC_VOLCANO_ANON_KEY;
    const database = process.env.NEXT_PUBLIC_VOLCANO_DATABASE;
    if (!anonKey || anonKey === 'ak-your-project-key' || !database) {
      throw new Error('Set your project anonymous key and database in .env.local, then restart the app.');
    }
    client = new VolcanoClient({ apiUrl: process.env.NEXT_PUBLIC_VOLCANO_API_URL, anonKey });
    client.database(database);
  }
  return client;
}
```


**`src/lib/types.ts`**

```typescript title="src/lib/types.ts"
export type Member = { id: string; display_name: string; bio: string; active: boolean };
export type Post = { id: string; author_id: string; body: string; like_count: number; comment_count: number; created_at: string };
export type Comment = { id: string; post_id: string; author_id: string; body: string; created_at: string };
export type Friendship = { id: string; requester_id: string; recipient_id: string; status: 'pending' | 'accepted' };
export type Message = { id: string; sender_id: string; recipient_id: string; body: string; is_read: boolean; sequence: number; created_at: string };
export type Notice = { id: string; title: string; is_read: boolean; created_at: string };
export type Snapshot = { posts: Post[]; authors: Member[]; people: Member[]; friends: Member[]; likes: string[]; saved: string[]; friendships: Friendship[]; notifications: Notice[]; hasMorePosts: boolean; hasMorePeople: boolean; unread: number };
export type Action = (work: () => Promise<unknown>, success: string) => Promise<void>;
```


**`src/lib/data.ts`**

```typescript title="src/lib/data.ts"
import { getVolcano } from './volcano';
import type { Comment, Friendship, Member, Message, Notice, Post, Snapshot } from './types';

export const memberColumns = 'id,display_name,bio,active';
const postColumns = 'id,author_id,body,like_count,comment_count,created_at';
const messageColumns = 'id,sender_id,recipient_id,body,is_read,sequence,created_at';

export async function loadMember(id: string) {
  const { data, error } = await getVolcano().from<Member>('community_members').select(memberColumns).eq('id', id).limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function loadSnapshot(userId: string, search: string, page: number, savedOnly: boolean, peoplePage: number): Promise<Snapshot> {
  const client = getVolcano();
  const bookmarks = await client.from<{ post_id: string }>('community_bookmarks').select('post_id').eq('user_id', userId).order('created_at', { ascending: false }).order('post_id', { ascending: false }).limit(21).offset(page * 20);
  if (bookmarks.error) throw bookmarks.error;
  const savedIds = (bookmarks.data ?? []).slice(0, 20).map(function id(row) { return row.post_id; });
  let posts: Post[] = [];
  let hasMorePosts = false;
  if (!savedOnly || savedIds.length > 0) {
    let query = client.from<Post>('community_posts').select(postColumns).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(21);
    if (!savedOnly && search.trim()) query = query.ilike('body', `%${search.trim()}%`);
    if (savedOnly) query = query.in('id', savedIds);
    else query = query.offset(page * 20);
    const result = await query;
    if (result.error) throw result.error;
    posts = (result.data ?? []).slice(0, 20);
    hasMorePosts = (result.data?.length ?? 0) > 20;
  }
  if (savedOnly) hasMorePosts = (bookmarks.data?.length ?? 0) > 20;
  const postIds = posts.map(function id(post) { return post.id; });
  const authorIds = [...new Set(posts.map(function id(post) { return post.author_id; }))];
  const people = await client.from<Member>('community_members').select(memberColumns).eq('active', true).order('display_name', { ascending: true }).order('id', { ascending: true }).limit(21).offset(peoplePage * 20);
  if (people.error) throw people.error;
  const friendships: Friendship[] = [];
  let cursor = '';
  for (;;) {
    let query = client.from<Friendship>('community_friendships').select('id,requester_id,recipient_id,status').order('id', { ascending: true }).limit(100);
    if (cursor) query = query.gt('id', cursor);
    const result = await query;
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    friendships.push(...rows);
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].id;
  }
  const friendIds = friendships.filter(function accepted(friend) { return friend.status === 'accepted'; }).map(function peer(friend) {
    if (friend.requester_id === userId) return friend.recipient_id;
    return friend.requester_id;
  });
  const friends: Member[] = [];
  for (let offset = 0; offset < friendIds.length; offset += 100) {
    const result = await client.from<Member>('community_members').select(memberColumns).in('id', friendIds.slice(offset, offset + 100)).eq('active', true).limit(100);
    if (result.error) throw result.error;
    friends.push(...result.data ?? []);
  }
  const unread = await loadUnreadCount(userId);
  const notifications = await client.from<Notice>('community_notifications').select('id,title,is_read,created_at').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
  if (notifications.error) throw notifications.error;
  let authors: Member[] = [];
  let likes: string[] = [];
  let saved: string[] = [];
  if (postIds.length) {
    const [profiles, reactions, bookmarksForPage] = await Promise.all([
      client.from<Member>('community_members').select(memberColumns).in('id', authorIds).limit(20),
      client.from<{ post_id: string }>('community_likes').select('post_id').eq('user_id', userId).in('post_id', postIds).limit(20),
      client.from<{ post_id: string }>('community_bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds).limit(20),
    ]);
    if (profiles.error) throw profiles.error;
    if (reactions.error) throw reactions.error;
    if (bookmarksForPage.error) throw bookmarksForPage.error;
    authors = profiles.data ?? [];
    likes = (reactions.data ?? []).map(function id(row) { return row.post_id; });
    saved = (bookmarksForPage.data ?? []).map(function id(row) { return row.post_id; });
  }
  return { posts, authors, people: (people.data ?? []).slice(0, 20), friends, friendships, notifications: notifications.data ?? [], likes, saved, hasMorePosts, hasMorePeople: (people.data?.length ?? 0) > 20, unread };
}

async function loadUnreadCount(userId: string) {
  let count = 0;
  let cursor = '';
  for (;;) {
    let query = getVolcano().from<{ id: string }>('community_messages').select('id').eq('recipient_id', userId).eq('is_read', false).order('id', { ascending: true }).limit(100);
    if (cursor) query = query.gt('id', cursor);
    const result = await query;
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    count += rows.length;
    if (rows.length < 100) return count;
    cursor = rows[rows.length - 1].id;
  }
}

export async function loadComments(postId: string, page: number) {
  const result = await getVolcano().from<Comment>('community_comments').select('id,post_id,author_id,body,created_at').eq('post_id', postId).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(20).offset(page * 20);
  if (result.error) throw result.error;
  return { rows: result.data ?? [] };
}

export async function loadMessages(userId: string, peer: string, page: number) {
  const result = await getVolcano().from<Message>('community_messages').select(messageColumns).in('sender_id', [userId, peer]).in('recipient_id', [userId, peer]).order('sequence', { ascending: false }).limit(21).offset(page * 20);
  if (result.error) throw result.error;
  return { rows: (result.data ?? []).slice(0, 20).reverse(), hasMore: (result.data?.length ?? 0) > 20 };
}

// Keep the same ID when retrying an ambiguously failed message submission.
export async function sendMessage(id: string, recipient: string, body: string) {
  const client = getVolcano();
  const result = await client.insert('community_messages', { id, recipient_id: recipient, body: body.trim() });
  if (!result.error) return;
  const existing = await client.from<Message>('community_messages').select(messageColumns).eq('id', id).limit(1);
  const message = existing.data?.[0];
  if (!existing.error && message && message.sender_id === client.auth.user()?.id && message.recipient_id === recipient && message.body === body.trim()) return;
  throw result.error;
}
```


## 5. Add signup and profile creation

Create `src/components/auth-form.tsx` from the authentication form (example below) and `src/app/reset-password/page.tsx` from the password reset page (example below).
Create the `src/app/reset-password` directory first.
It provides signup, signin, and recovery-email controls with labeled fields and visible loading, success, and error states.
Passwords require at least 15 characters.

Signup creates an account without automatically signing the user in.
If confirmation is enabled, the form asks them to confirm their email first.
Recovery email requires transactional email configuration.
Configure its reset link to reach your app's `/reset-password?token=…` page; that page calls the SDK to set the new password, then asks the person to sign in again.
See [password recovery](/sdk/js/authentication#password-recovery) for the underlying API.

After signin, the workspace asks for a display name and creates the member's profile:

```typescript
const { error } = await getVolcano().insert('community_members', {
  display_name: displayName.trim(),
});
if (error) throw error;
```

The database supplies the account ID, privately binds its login email, and sets `active` to true.
The member can enter the community immediately after creating their profile.
Operators can deactivate accounts through the SQL console, but members cannot reactivate themselves.

**`src/components/auth-form.tsx`**

```tsx title="src/components/auth-form.tsx"
'use client';

import { useState, type FormEvent } from 'react';
import { getVolcano } from '../lib/volcano';

export function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'The request failed. Check your connection and try again.';
}

type AuthFormProps = { configurationError: string };

export function AuthForm({ configurationError }: AuthFormProps) {
  const [mode, setMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true); setError(''); setSuccess('');
    try {
      const client = getVolcano();
      await client.initialize();
      if (mode === 'signup') {
        const result = await client.auth.signUp({ email, password });
        if (result.error) throw result.error;
        if (result.confirmationRequired) setSuccess('Signup successful. Check your email to confirm the account, then sign in.');
        else setSuccess('Signup successful. Sign in and choose a display name to join the community.');
      } else if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setSuccess('If recovery email is configured and this account exists, you will receive instructions. Contact the community operator if you need help.');
      } else {
        const { error } = await client.auth.signIn({ email, password });
        if (error) throw error;
      }
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  function signInMode() { setMode('signin'); setSuccess(''); setError(''); }
  function signupMode() { setMode('signup'); setSuccess(''); setError(''); }
  function resetMode() { setMode('reset'); setSuccess(''); setError(''); }
  let title = 'Sign in to Community';
  let action = 'Sign in';
  if (mode === 'signup') { title = 'Create your account'; action = 'Sign up'; }
  if (mode === 'reset') { title = 'Request password help'; action = 'Send recovery email'; }
  let passwordAutoComplete = 'current-password';
  if (mode === 'signup') passwordAutoComplete = 'new-password';
  if (busy) action = 'Working…';
  return (
    <main data-slot="auth" className="community-app auth-page">
      <section className="panel">
        <h1>{title}</h1>
        <p>Anyone can sign up. Sign in and choose a display name to join the community.</p>
        {configurationError && <p role="alert">{configurationError}</p>}
        {error && <p role="alert">{error}</p>}
        {success && <p role="status">{success}</p>}
        <form onSubmit={submit}>
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" required />
          {mode !== 'reset' && <>
            <label htmlFor="auth-password">Password (at least 15 characters)</label>
            <input id="auth-password" name="password" type="password" autoComplete={passwordAutoComplete} minLength={15} required />
          </>}
          <button type="submit" disabled={busy} aria-busy={busy}>{action}</button>
        </form>
        <div className="actions">
          <button type="button" onClick={signInMode}>Sign in</button>
          <button type="button" onClick={signupMode}>Create account</button>
          <button type="button" onClick={resetMode}>Forgot password?</button>
        </div>
      </section>
    </main>
  );
}
```


**`src/app/reset-password/page.tsx`**

```tsx title="src/app/reset-password/page.tsx"
'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { getVolcano } from '../../lib/volcano';
import { errorText } from '../../components/auth-form';

export default function ResetPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const token = new URLSearchParams(window.location.search).get('token') || String(data.get('token') ?? '').trim();
    if (!token) { setError('Open your recovery email link or enter its recovery token.'); return; }
    setBusy(true); setError('');
    try {
      const { error } = await getVolcano().auth.resetPassword({ token, newPassword: String(data.get('password') ?? '') });
      if (error) throw error;
      window.history.replaceState(null, '', '/reset-password');
      setDone(true);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  return <main data-slot="reset-password" className="community-app auth-page"><section className="panel">
    <h1>Reset your password</h1>
    {error && <p role="alert">{error}</p>}
    {done && <p role="status">Password updated. Sign in with your new password.</p>}
    {!done && <form onSubmit={submit}>
      <label htmlFor="reset-token">Recovery token (leave empty if opened from your recovery email)</label>
      <input id="reset-token" name="token" type="password" autoComplete="off" />
      <label htmlFor="reset-password">New password (at least 15 characters)</label>
      <input id="reset-password" name="password" type="password" autoComplete="new-password" minLength={15} required />
      <button type="submit" disabled={busy} aria-busy={busy}>Set new password</button>
    </form>}
    <Link href="/">Return to sign in</Link>
  </section></main>;
}
```


## 6. Build posts, comments, likes, and bookmarks

Create `src/components/post-card.tsx` from the post and comment components (example below).
It renders the author, publication time, body, counts, ownership controls, reactions, and a paginated comment list.
Open comments reload whenever the workspace refreshes, even if the comment count stays unchanged.
Post, comment, and message composers disable editing during submission, preserve text on failure, and clear it only after success.

The composer sends only the post text:

```typescript
const { error } = await getVolcano().insert('community_posts', {
  body: text.trim(),
});
if (error) throw error;
```

Comments supply a post ID and reply:

```typescript
const { error } = await getVolcano().insert('community_comments', {
  post_id: postId,
  body: reply.trim(),
});
if (error) throw error;
```

A like or bookmark inserts only `post_id` into its corresponding table; removing it deletes the current user's row.
The database prevents duplicate reactions, updates public counts, and keeps bookmark lists private.
Only authors see edit and delete controls for their posts, and policies enforce ownership independently of the interface.

**`src/components/post-card.tsx`**

```tsx title="src/components/post-card.tsx"
'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { getVolcano } from '../lib/volcano';
import { loadComments } from '../lib/data';
import { errorText } from './auth-form';
import type { Action, Comment, Post } from '../lib/types';

type PostCardProps = { post: Post; version: number; author: string; userId: string; liked: boolean; saved: boolean; busy: boolean; onAction: Action };

export function PostCard({ post, version, author, userId, liked, saved, busy, onAction }: PostCardProps) {
  const [editing, setEditing] = useState(false);
  function openEdit() { setEditing(true); }
  async function editPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get('body') ?? '').trim();
    async function edit() {
      const { error } = await getVolcano().update('community_posts', { body }).eq('id', post.id);
      if (error) throw error;
      setEditing(false);
    }
    await onAction(edit, 'Post updated.');
  }
  async function deletePost() {
    if (!window.confirm('Delete this post and its comments?')) return;
    async function remove() { const { error } = await getVolcano().delete('community_posts').eq('id', post.id); if (error) throw error; }
    await onAction(remove, 'Post deleted.');
  }
  async function toggleLike() {
    async function change() {
      const client = getVolcano();
      if (liked) {
        const { error } = await client.delete('community_likes').eq('post_id', post.id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await client.insert('community_likes', { post_id: post.id });
        if (error) throw error;
      }
    }
    await onAction(change, 'Reaction updated.');
  }
  async function toggleSave() {
    async function change() {
      const client = getVolcano();
      if (saved) {
        const { error } = await client.delete('community_bookmarks').eq('post_id', post.id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await client.insert('community_bookmarks', { post_id: post.id });
        if (error) throw error;
      }
    }
    await onAction(change, 'Saved posts updated.');
  }
  return (
    <article data-slot="post" className="panel">
      <header><h2>{author}</h2><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time></header>
      <p className="post-body">{post.body}</p>
      <div className="actions">
        <button type="button" onClick={toggleLike} disabled={busy} aria-pressed={liked}>Like ({post.like_count})</button>
        <button type="button" onClick={toggleSave} disabled={busy} aria-pressed={saved}>Save</button>
        {post.author_id === userId && <>
          <button type="button" onClick={openEdit} disabled={busy}>Edit</button>
          <button type="button" onClick={deletePost} disabled={busy}>Delete</button>
        </>}
      </div>
      {editing && <form onSubmit={editPost}>
        <label htmlFor={`edit-${post.id}`}>Edit post</label>
        <textarea id={`edit-${post.id}`} name="body" defaultValue={post.body} maxLength={4000} disabled={busy} required />
        <button disabled={busy} type="submit">Save changes</button>
      </form>}
      <Comments postId={post.id} version={version} count={post.comment_count} userId={userId} onAction={onAction} busy={busy} />
    </article>
  );
}

type CommentsProps = { postId: string; version: number; count: number; userId: string; busy: boolean; onAction: Action };

function Comments({ postId, version, count, userId, onAction, busy }: CommentsProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Comment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const reload = useCallback(function reloadComments() {
    const request = ++generation.current;
    return loadComments(postId, page).then(function loaded(result) {
      if (request === generation.current) { setRows(result.rows); setError(''); }
    }).catch(function failed(cause) { if (request === generation.current) setError(errorText(cause)); })
      .finally(function finished() { if (request === generation.current) setLoading(false); });
  }, [postId, page]);
  function cancelLoad() { generation.current++; }
  useEffect(function load() {
    if (open) void reload();
    return cancelLoad;
  }, [open, reload, count, version]);
  function toggle() { if (!open) setLoading(true); setOpen(!open); }
  function previous() { setLoading(true); setPage(Math.max(0, page - 1)); }
  function next() { setLoading(true); setPage(page + 1); }
  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    async function add() {
      const { error } = await getVolcano().insert('community_comments', { post_id: postId, body });
      if (error) throw error;
      form.reset(); await reload();
    }
    await onAction(add, 'Comment added.');
  }
  return (
    <section>
      <button type="button" onClick={toggle} aria-expanded={open}>Comments ({count})</button>
      {open && <>
        {loading && <p role="status">Loading comments…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !rows.length && <p>No comments yet. Start the conversation.</p>}
        <ul className="comment-list">{rows.map(function renderComment(row) {
          let label = 'Community member';
          if (row.author_id === userId) label = 'You';
          async function remove() {
            async function work() { const { error } = await getVolcano().delete('community_comments').eq('id', row.id); if (error) throw error; await reload(); }
            await onAction(work, 'Comment deleted.');
          }
          return <li key={row.id}><strong>{label}</strong><p>{row.body}</p>{row.author_id === userId && <button type="button" onClick={remove} disabled={busy}>Delete comment</button>}</li>;
        })}</ul>
        <div className="actions"><button type="button" onClick={previous} disabled={page === 0}>Previous comments</button><button type="button" onClick={next} disabled={(page + 1) * 20 >= count}>More comments</button></div>
        <form onSubmit={addComment}>
          <label htmlFor={`comment-${postId}`}>Write a comment</label>
          <textarea id={`comment-${postId}`} name="body" maxLength={2000} disabled={busy} required />
          <button type="submit" disabled={busy} aria-busy={busy}>Add comment</button>
        </form>
      </>}
    </section>
  );
}
```


## 7. Add friendships and private messages

Create these components:

| Local filename | Contents |
| --- | --- |
| `src/components/people.tsx` | People and friend requests (example below) |
| `src/components/chat.tsx` | Private conversations (example below) |

People shows active profiles and lets members send, accept, decline, cancel, and remove connections.
An unordered-pair database index prevents reversed duplicate requests.
Only the recipient can change a pending request to `accepted`.

Messages require active membership and an accepted friendship between the participants.
The sender supplies a stable message ID, recipient, and body:

```typescript
const { error } = await getVolcano().insert('community_messages', {
  id: messageId,
  recipient_id: friendId,
  body: text.trim(),
});
if (error) throw error;
```

The complete `sendMessage()` in `data.ts` reuses the same ID across an uncertain submission and checks whether that exact message exists before treating a retry as successful.
Conversations support 2,000-character messages, older-history navigation, unread counts, and an explicit recipient Mark read action.

Removing a friendship blocks its retained message history and new messages.
Accepting a new friendship between the same people restores access to that history.
Deactivating a member also blocks their community data access.

**`src/components/people.tsx`**

```tsx title="src/components/people.tsx"
'use client';

import type { Action, Friendship, Member } from '../lib/types';
import { getVolcano } from '../lib/volcano';

type PeopleProps = { people: Member[]; friendships: Friendship[]; userId: string; busy: boolean; onAction: Action; onMessage: (id: string) => void };

export function People({ people, friendships, userId, busy, onAction, onMessage }: PeopleProps) {
  return <div className="stack">{people.filter(function others(person) { return person.id !== userId; }).map(function personCard(person) {
    const friendship = friendships.find(function matches(row) { return row.requester_id === person.id || row.recipient_id === person.id; });
    async function request() {
      async function work() { const { error } = await getVolcano().insert('community_friendships', { recipient_id: person.id }); if (error) throw error; }
      await onAction(work, 'Friend request sent.');
    }
    async function accept() {
      if (!friendship) return;
      async function work() { const { error } = await getVolcano().update('community_friendships', { status: 'accepted' }).eq('id', friendship!.id); if (error) throw error; }
      await onAction(work, 'Friend request accepted.');
    }
    async function remove() {
      if (!friendship) return;
      if (friendship.status === 'accepted' && !window.confirm('Remove this friendship? Both accounts will lose access to the conversation.')) return;
      async function work() { const { error } = await getVolcano().delete('community_friendships').eq('id', friendship!.id); if (error) throw error; }
      await onAction(work, 'Connection updated.');
    }
    function message() { onMessage(person.id); }
    return <article className="panel" key={person.id}>
      <h2>{person.display_name}</h2><p>{person.bio || 'No bio yet.'}</p>
      <div className="actions">
        {!friendship && <button type="button" onClick={request} disabled={busy}>Add friend</button>}
        {friendship?.status === 'pending' && friendship.recipient_id === userId && <button type="button" onClick={accept} disabled={busy}>Accept request</button>}
        {friendship?.status === 'pending' && <button type="button" onClick={remove} disabled={busy}>Cancel or decline request</button>}
        {friendship?.status === 'accepted' && <><button type="button" onClick={message}>Message</button><button type="button" onClick={remove} disabled={busy}>Remove friend</button></>}
      </div>
    </article>;
  })}</div>;
}
```


**`src/components/chat.tsx`**

```tsx title="src/components/chat.tsx"
'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { loadMessages, sendMessage } from '../lib/data';
import { getVolcano } from '../lib/volcano';
import type { Action, Member, Message } from '../lib/types';
import { errorText } from './auth-form';

type ChatProps = { userId: string; friends: Member[]; peer: string; onPeerChange: (id: string) => void; version: number; busy: boolean; onAction: Action };

export function Chat({ userId, friends, peer, onPeerChange, version, busy, onAction }: ChatProps) {
  const [rows, setRows] = useState<Message[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const draft = useRef<{ id: string; peer: string; body: string } | null>(null);
  const available = friends.some(function matches(friend) { return friend.id === peer; });
  const reload = useCallback(function reloadConversation() {
    const request = ++generation.current;
    if (!peer || !available) return Promise.resolve();
    return loadMessages(userId, peer, page).then(function loaded(result) {
      if (request === generation.current) { setRows(result.rows); setHasMore(result.hasMore); setError(''); }
    }).catch(function failed(cause) { if (request === generation.current) setError(errorText(cause)); })
      .finally(function finished() { if (request === generation.current) setLoading(false); });
  }, [userId, peer, page, available]);
  function cancelLoad() { generation.current++; }
  useEffect(function load() { void reload(); return cancelLoad; }, [reload, version]);
  function selectPeer(event: ChangeEvent<HTMLSelectElement>) { setPage(0); setRows([]); setHasMore(false); draft.current = null; onPeerChange(event.target.value); }
  function older() { setLoading(true); setPage(page + 1); }
  function newer() { setLoading(true); setPage(Math.max(0, page - 1)); }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body || !available) return;
    if (!draft.current || draft.current.peer !== peer || draft.current.body !== body) draft.current = { id: crypto.randomUUID(), peer, body };
    const pending = draft.current;
    async function work() { await sendMessage(pending.id, pending.peer, pending.body); draft.current = null; form.reset(); setPage(0); await reload(); }
    await onAction(work, 'Message sent.');
  }
  async function markRead() {
    const through = rows[rows.length - 1]?.sequence;
    if (!through) return;
    async function work() {
      const { error } = await getVolcano().update('community_messages', { is_read: true }).eq('recipient_id', userId).eq('sender_id', peer).eq('is_read', false).lte('sequence', through);
      if (error) throw error;
      await reload();
    }
    await onAction(work, 'Conversation marked read.');
  }
  return <section className="panel">
    <h2>Private messages</h2>
    {!friends.length && <p>Accept a friend request from People before starting a conversation.</p>}
    <label htmlFor="chat-peer">Conversation</label>
    <select id="chat-peer" value={peer} onChange={selectPeer}>
      <option value="">Choose a friend</option>
      {friends.map(function option(friend) { return <option key={friend.id} value={friend.id}>{friend.display_name}</option>; })}
    </select>
    {error && <p role="alert">{error}</p>}
    {loading && available && <p role="status">Loading conversation…</p>}
    {peer && !available && <p>This conversation is unavailable. Check that both members are active friends.</p>}
    {available && <>
      {!loading && !rows.length && <p>No messages yet. Say hello.</p>}
      <ol className="messages">{rows.map(function message(row) {
        let name = 'Friend';
        if (row.sender_id === userId) name = 'You';
        let receipt = 'Unread';
        if (row.is_read) receipt = 'Read';
        return <li key={row.id}><strong>{name}</strong><p>{row.body}</p><small>{receipt}</small></li>;
      })}</ol>
      <div className="actions"><button onClick={older} type="button" disabled={!hasMore}>Older messages</button><button onClick={newer} type="button" disabled={page === 0}>Newer messages</button><button onClick={markRead} type="button" disabled={busy || !rows.length}>Mark read</button></div>
      <form onSubmit={send} key={peer}>
        <label htmlFor="message-body">Message (up to 2,000 characters)</label>
        <textarea id="message-body" name="body" maxLength={2000} disabled={busy} required />
        <button type="submit" disabled={busy} aria-busy={busy}>Send message</button>
      </form>
    </>}
  </section>;
}
```


## 8. Connect realtime updates

Create `src/components/use-live-updates.ts` from the realtime hook (example below), and `volcano/volcano-config.yaml` from the project manifest (example below).
The manifest enables PostgreSQL change events and leaves broadcast and presence disabled:

```yaml
version: 1
realtime:
  enabled: true
  postgres_changes_enabled: true
  broadcast_enabled: false
  presence_enabled: false
```

Apply the manifest to enable realtime in your selected project:

```bash
volcano cloud config deploy --file volcano/volcano-config.yaml --dry-run
volcano cloud config deploy --file volcano/volcano-config.yaml
```

The hook subscribes to `public:community_inboxes`.
Users receive changes for their own identity-based inbox row; private message text never enters that signal.
On a version change, the app reloads through ordinary authenticated queries, which enforce the full membership and friendship rules.

The hook registers listeners before subscribing, refreshes tokens, reloads after reconnecting, and cleans up on signout or unmount.
Failed connections or subscriptions retry with bounded backoff; the delay resets only after a successful subscription.
Connections restart when the browser comes online; session restoration also retries on the online event.
The connection is tied to the signed-in account; a ref supplies the latest committed refresh callback without reconnecting when filters change.
Asynchronous writes also refresh through the latest callback, so a write started in Feed cannot overwrite Saved with an older Feed query.
Focus and visible 30-second reconciliation recover missed changes.
The interface shows connection status and keeps manual Refresh available.

This signal design is intended for a small community.
A public feed change increments every active member's inbox, and count-maintaining triggers can emit additional changes for one interaction.
Each connected client then reloads its snapshot, so writes and reloads grow with the member count and compete for inbox row locks.
For larger audiences, use one shared feed-change signal or a suitably authorized broadcast, and reserve per-member inbox signals for private events.

**`src/components/use-live-updates.ts`**

```typescript title="src/components/use-live-updates.ts"
'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { VolcanoRealtime } from '@volcano.dev/sdk/realtime';
import { getVolcano } from '../lib/volcano';

export function useLiveUpdates(userId: string, refresh: () => Promise<void>) {
  const [connection, setConnection] = useState('Connecting live updates…');
  const refreshRef = useRef(refresh);
  useLayoutEffect(function commitRefresh() { refreshRef.current = refresh; }, [refresh]);
  useEffect(function connectInbox() {
    let active = true;
    let realtime: VolcanoRealtime | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    let retryDelay = 1000;
    function dispose() {
      generation++;
      const previous = realtime;
      realtime = undefined;
      previous?.removeAllChannels(); previous?.disconnect();
    }
    function restart() {
      clearTimeout(retryTimer); retryTimer = undefined;
      if (!active) return;
      dispose();
      void connect();
    }
    function retry(delay: number) {
      if (!active || retryTimer) return;
      retryTimer = setTimeout(function reconnect() {
        retryTimer = undefined;
        if (!realtime?.isConnected()) restart();
      }, delay);
    }
    function schedule() {
      if (!active || document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      timer = setTimeout(function reconcile() { if (active) void refreshRef.current(); }, 150);
    }
    async function connect() {
      const attempt = ++generation;
      function current() { return active && attempt === generation; }
      try {
        const client = getVolcano();
        const { data: { session }, error } = await client.auth.getSession();
        if (error) throw error;
        if (!current() || !session?.access_token) return;
        const instance = new VolcanoRealtime({
          apiUrl: process.env.NEXT_PUBLIC_VOLCANO_API_URL ?? 'https://api.volcano.dev',
          anonKey: process.env.NEXT_PUBLIC_VOLCANO_ANON_KEY!,
          accessToken: session.access_token,
          volcanoClient: client,
          databaseName: process.env.NEXT_PUBLIC_VOLCANO_DATABASE,
          async getToken() {
            if (!current() || client.auth.user()?.id !== userId) throw new Error('Session changed');
            const result = await client.auth.refreshSession();
            if (result.error) throw result.error;
            if (!current() || client.auth.user()?.id !== userId || !result.session?.access_token) throw new Error('Sign in again');
            return result.session.access_token;
          },
        });
        realtime = instance;
        const channel = instance.channel('public:community_inboxes', { type: 'postgres' });
        channel.onPostgresChanges('*', 'public', 'community_inboxes', schedule);
        let subscribed = false;
        instance.onConnect(function connected() {
          if (!current()) return;
          clearTimeout(retryTimer); retryTimer = undefined;
          if (subscribed) { setConnection('Live updates connected'); schedule(); }
          else setConnection('Subscribing to live updates…');
        });
        instance.onDisconnect(function disconnected() { if (current()) { setConnection('Reconnecting; Refresh is available'); retry(5000); } });
        instance.onError(function failed() { if (current()) { setConnection('Live updates unavailable; retrying. Refresh is available'); retry(5000); } });
        await instance.connect();
        if (!current()) { instance.disconnect(); return; }
        await channel.subscribe();
        if (!current()) { instance.disconnect(); return; }
        subscribed = true; retryDelay = 1000;
        setConnection('Live updates connected'); schedule();
      } catch {
        if (!current()) return;
        dispose();
        setConnection('Live updates unavailable; retrying. Check permissions and allowed origins. Refresh still works.');
        retry(retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    }
    function online() { restart(); schedule(); }
    void connect();
    window.addEventListener('focus', schedule);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', schedule);
    const interval = setInterval(schedule, 30000);
    return function cleanup() {
      active = false; clearTimeout(timer); clearTimeout(retryTimer); clearInterval(interval);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', schedule);
      dispose();
    };
  }, [userId]);
  return connection;
}
```


**`volcano/volcano-config.yaml`**

```yaml title="volcano/volcano-config.yaml"
version: 1
realtime:
  enabled: true
  postgres_changes_enabled: true
  broadcast_enabled: false
  presence_enabled: false
```


## 9. Assemble the interface and run it

Create the remaining files:

| Local filename | Contents | Purpose |
| --- | --- | --- |
| `src/components/community-app.tsx` | Application workspace (example below) | Sessions, onboarding, navigation, composer, profiles, and notifications |
| `src/app/globals.css` | Styles (example below) | Semantic tokens, forms, panels, and responsive layout |
| `src/app/layout.tsx` | Root layout (example below) | Document shell and stylesheet |
| `src/app/page.tsx` | Homepage (example below) | Render the application |

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:3000`, create an account, sign in, choose a display name, and click Join community.
If email confirmation is enabled, confirm the email before signing in.
You enter the app immediately after profile creation, without an invitation or operator approval.
Repeat with a second account in another browser profile to test friendships and messages.

**Checkpoint:** newly joined accounts see Feed, Saved, People, Messages, Notifications, and Profile.
Publish a post and refresh the second account's feed to confirm it appears.

**`src/components/community-app.tsx`**

```tsx title="src/components/community-app.tsx"
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { User } from '@volcano.dev/sdk';
import { getVolcano } from '../lib/volcano';
import { loadMember, loadSnapshot } from '../lib/data';
import type { Member, Snapshot } from '../lib/types';
import { AuthForm, errorText } from './auth-form';
import { PostCard } from './post-card';
import { People } from './people';
import { Chat } from './chat';
import { useLiveUpdates } from './use-live-updates';

export function CommunityApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(function restore() {
    let active = true;
    let generation = 0;
    let unsubscribe: (() => void) | undefined;
    async function initialize() { try {
      const client = getVolcano();
      if (!unsubscribe) unsubscribe = client.auth.onAuthStateChange(function changed(next) { generation++; if (active) { setUser(next); setError(''); } });
      const attempt = ++generation;
      const result = await client.initialize();
        if (!active || attempt !== generation) return;
        if (result.error) { setError(errorText(result.error)); return; }
        setUser(result.user); setError('');
    } catch (cause) { if (active) { setError(errorText(cause)); setLoading(false); } } }
    function restoreSession() { void initialize().finally(function restored() { if (active) setLoading(false); }); }
    restoreSession();
    window.addEventListener('online', restoreSession);
    return function cleanup() { active = false; generation++; unsubscribe?.(); window.removeEventListener('online', restoreSession); };
  }, []);
  if (loading) return <main className="community-app"><p role="status">Restoring your session…</p></main>;
  if (!user) return <AuthForm configurationError={error} />;
  return <Workspace user={user} key={user.id} />;
}

type WorkspaceProps = { user: User };
const tabs = ['Feed','Saved','People','Messages','Notifications','Profile'];

function Workspace({ user }: WorkspaceProps) {
  const [member, setMember] = useState<Member | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState('Feed');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [peoplePage, setPeoplePage] = useState(0);
  const [peer, setPeer] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const mounted = useRef(true);
  function cancelLoad() { generation.current++; }
  useEffect(function trackMount() { mounted.current = true; return function unmount() { mounted.current = false; cancelLoad(); }; }, []);
  const refresh = useCallback(function refreshData() {
    const request = ++generation.current;
    return loadMember(user.id).then(async function loadedMember(nextMember) {
      let nextSnapshot: Snapshot | null = null;
      if (nextMember?.active) nextSnapshot = await loadSnapshot(user.id, search, page, tab === 'Saved', peoplePage);
      if (request !== generation.current || !mounted.current) return;
      setMember(nextMember); setSnapshot(nextSnapshot); setLoaded(true); setError(''); setVersion(function increment(n) { return n + 1; });
    }).catch(function failed(cause) { if (request === generation.current && mounted.current) { setError(errorText(cause)); setLoaded(true); } })
      .finally(function finished() { if (request === generation.current && mounted.current) setRefreshing(false); });
  }, [user.id, search, page, tab, peoplePage]);
  const refreshRef = useRef(refresh);
  useLayoutEffect(function commitRefresh() { refreshRef.current = refresh; generation.current++; }, [refresh]);
  useEffect(function load() { void refresh(); return cancelLoad; }, [refresh]);
  const connection = useLiveUpdates(user.id, refresh);
  async function runAction(work: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setStatus('Saving…'); setError('');
    try { await work(); if (mounted.current) { setStatus(success); await refreshRef.current(); } }
    catch (cause) { if (mounted.current) { setError(errorText(cause)); setStatus(''); } }
    finally { if (mounted.current) setBusy(false); }
  }
  async function signOut() {
    try { const { error } = await getVolcano().auth.signOut(); if (error && mounted.current) setError(errorText(error)); }
    catch (cause) { setError(errorText(cause)); }
  }
  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const display_name = String(new FormData(event.currentTarget).get('display_name') ?? '').trim();
    async function work() { const { error } = await getVolcano().insert('community_members', { display_name }); if (error) throw error; }
    await runAction(work, 'Profile created. Welcome to the community!');
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    async function work() { const { error } = await getVolcano().insert('community_posts', { body }); if (error) throw error; form.reset(); setPage(0); }
    await runAction(work, 'Post published.');
  }
  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    async function work() {
      const { error } = await getVolcano().update('community_members', { display_name: String(data.get('display_name') ?? '').trim(), bio: String(data.get('bio') ?? '').trim() }).eq('id', user.id);
      if (error) throw error;
    }
    await runAction(work, 'Profile saved.');
  }
  function changeSearch(event: ChangeEvent<HTMLInputElement>) { setPage(0); setSearch(event.target.value); }
  function previousPosts() { setPage(Math.max(0, page - 1)); }
  function nextPosts() { setPage(page + 1); }
  function previousPeople() { setPeoplePage(Math.max(0, peoplePage - 1)); }
  function nextPeople() { setPeoplePage(peoplePage + 1); }
  function openMessage(id: string) { setPeer(id); setTab('Messages'); }
  function manualRefresh() { setRefreshing(true); void refresh(); }
  let progress = '';
  if (refreshing) progress = 'Refreshing…';
  return (
    <main data-slot="community" className="community-app">
      <header className="app-header"><div><h1>Community</h1><p>{user.email}</p></div><button type="button" onClick={signOut}>Sign out</button></header>
      <div className="feedback">
        {error && <p role="alert">{error} If a write could not be confirmed, refresh before submitting it again.</p>}
        <p role="status">{status} {progress}</p>
      </div>
      {!loaded && <p role="status">Loading your community access…</p>}
      {loaded && !member && <section className="panel"><h2>Create your profile</h2><form onSubmit={enroll}><label htmlFor="join-name">Display name</label><input id="join-name" name="display_name" maxLength={80} required /><button type="submit" disabled={busy} aria-busy={busy}>Join community</button></form></section>}
      {loaded && member && !member.active && <section className="panel"><h2>Account deactivated</h2><p>Contact the community operator if you believe this is a mistake.</p><button type="button" onClick={manualRefresh} disabled={refreshing}>Check account status</button></section>}
      {member?.active && snapshot && <>
        <nav className="tabs" aria-label="Community navigation">{tabs.map(function renderTab(name) {
          function selectTab() { setTab(name); setPage(0); }
          let label = name;
          if (name === 'Messages') label = `Messages (${snapshot.unread})`;
          return <button type="button" key={name} onClick={selectTab} aria-current={tab === name}>{label}</button>;
        })}<button type="button" onClick={manualRefresh} disabled={refreshing}>Refresh</button></nav>
        <p className="muted">{connection}</p>
        {tab === 'Feed' && <>
          <form onSubmit={publish} className="panel"><label htmlFor="new-post">Share something (up to 4,000 characters)</label><textarea id="new-post" name="body" maxLength={4000} disabled={busy} required /><button type="submit" disabled={busy} aria-busy={busy}>Publish post</button></form>
          <label htmlFor="feed-search">Search posts</label><input id="feed-search" type="search" value={search} onChange={changeSearch} />
        </>}
        {(tab === 'Feed' || tab === 'Saved') && <>
          <h2>{tab}</h2>
          {!snapshot.posts.length && <p>No posts here yet. Publish one from Feed or adjust your search.</p>}
          <div className="stack">{snapshot.posts.map(function renderPost(post) {
            const author = snapshot.authors.find(function matching(profile) { return profile.id === post.author_id; });
            return <PostCard key={post.id} post={post} version={version} author={author?.display_name ?? 'Community member'} userId={user.id} liked={snapshot.likes.includes(post.id)} saved={snapshot.saved.includes(post.id)} busy={busy} onAction={runAction} />;
          })}</div>
          <div className="actions"><button type="button" onClick={previousPosts} disabled={page === 0}>Previous posts</button><span>Page {page + 1}</span><button type="button" onClick={nextPosts} disabled={!snapshot.hasMorePosts}>Next posts</button></div>
        </>}
        {tab === 'People' && <><h2>People</h2><People people={snapshot.people} friendships={snapshot.friendships} userId={user.id} busy={busy} onAction={runAction} onMessage={openMessage} /><div className="actions"><button type="button" onClick={previousPeople} disabled={peoplePage === 0}>Previous people</button><button type="button" onClick={nextPeople} disabled={!snapshot.hasMorePeople}>Next people</button></div></>}
        {tab === 'Messages' && <Chat key={peer} userId={user.id} friends={snapshot.friends} peer={peer} onPeerChange={setPeer} version={version} busy={busy} onAction={runAction} />}
        {tab === 'Notifications' && <section className="panel"><h2>Latest 50 notifications</h2>{!snapshot.notifications.length && <p>No notifications yet. Friend requests and comments on your posts will appear here.</p>}<ul>{snapshot.notifications.map(function notice(item) {
          async function markRead() {
            async function work() { const { error } = await getVolcano().update('community_notifications', { is_read: true }).eq('id', item.id); if (error) throw error; }
            await runAction(work, 'Notification marked read.');
          }
          return <li key={item.id}><p>{item.title}</p>{!item.is_read && <button type="button" onClick={markRead} disabled={busy}>Mark notification read</button>}{item.is_read && <small>Read</small>}</li>;
        })}</ul></section>}
        {tab === 'Profile' && <section className="panel"><h2>Your profile</h2><form onSubmit={updateProfile}><label htmlFor="profile-name">Display name</label><input id="profile-name" name="display_name" defaultValue={member.display_name} maxLength={80} required /><label htmlFor="profile-bio">Bio</label><textarea id="profile-bio" name="bio" defaultValue={member.bio} maxLength={500} /><button type="submit" disabled={busy} aria-busy={busy}>Save profile</button></form></section>}
      </>}
    </main>
  );
}
```


**`src/app/globals.css`**

```css title="src/app/globals.css"
:root {
  --surface-page: #f3f5f7;
  --surface-panel: #ffffff;
  --surface-control: #ffffff;
  --text-primary: #182333;
  --text-secondary: #465469;
  --color-primary: #244ac4;
  --color-primary-foreground: #ffffff;
  --color-border: #a8b3c3;
  --spacing-xs: 0.375rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --radius-panel: 0.75rem;
  --radius-control: 0.375rem;
  --border-width: 1px;
  --focus-width: 3px;
  --font-body: system-ui, sans-serif;
  --font-size-body: 1rem;
  --line-height-body: 1.6;
  --content-width: 58rem;
  --auth-width: 32rem;
  --control-height: 2.75rem;
  --text-area-height: 6rem;
  --disabled-opacity: 0.6;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--surface-page); color: var(--text-primary); font-family: var(--font-body); font-size: var(--font-size-body); line-height: var(--line-height-body); }
.community-app { --cmp-width: var(--content-width); --cmp-padding: var(--spacing-lg); width: 100%; max-width: var(--cmp-width); margin: auto; padding: var(--cmp-padding); }
.auth-page { --cmp-width: var(--auth-width); }
.panel { --cmp-bg: var(--surface-panel); --cmp-padding: var(--spacing-lg); --cmp-radius: var(--radius-panel); background: var(--cmp-bg); padding: var(--cmp-padding); border: var(--border-width) solid var(--color-border); border-radius: var(--cmp-radius); margin-block: var(--spacing-md); overflow-wrap: anywhere; }
.app-header, .actions, .tabs { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm); }
.app-header { justify-content: space-between; }
.stack { display: grid; gap: var(--spacing-md); }
form { display: grid; gap: var(--spacing-sm); }
label { display: block; }
input, textarea, select, button { font: inherit; border: var(--border-width) solid var(--color-border); border-radius: var(--radius-control); padding: var(--spacing-sm); min-height: var(--control-height); max-width: 100%; }
input, textarea, select { width: 100%; color: var(--text-primary); background: var(--surface-control); }
textarea { min-height: var(--text-area-height); resize: vertical; }
button { cursor: pointer; color: var(--color-primary-foreground); background: var(--color-primary); }
button:disabled { opacity: var(--disabled-opacity); cursor: default; }
button[aria-current="true"] { outline: var(--focus-width) solid var(--text-primary); outline-offset: var(--spacing-xs); }
:focus-visible { outline: var(--focus-width) solid var(--color-primary); outline-offset: var(--spacing-xs); }
.muted, small, time { color: var(--text-secondary); }
.feedback { min-height: var(--control-height); }
.actions, .tabs { margin-block: var(--spacing-md); }
p { white-space: pre-wrap; overflow-wrap: anywhere; }
code { overflow-wrap: anywhere; }
```


**`src/app/layout.tsx`**

```tsx title="src/app/layout.tsx"
import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'Community', description: 'A social community open to anyone to sign up, built on Volcano.' };
type RootLayoutProps = { children: ReactNode };

export default function RootLayout({ children }: RootLayoutProps) {
  return <html lang="en"><body>{children}</body></html>;
}
```


**`src/app/page.tsx`**

```tsx title="src/app/page.tsx"
import { CommunityApp } from '../components/community-app';

export default function Page() { return <CommunityApp />; }
```


## 10. Verify the application

Create `tests/security.test.mjs` from the database policy test (example below), then run:

```bash
npm test
npm run typecheck
npm run build
```

The test uses a local PostgreSQL-compatible PGlite database with simulated authenticated identities.
It checks migration reruns, private account-email access, safe profile insert responses, immediate access after profile creation, author spoofing, ownership, private bookmarks, reaction counts, friend acceptance, message access, read receipts, and revoked access.
It does not connect to your cloud project or replace a two-account browser check.

In the running application:

1. Publish and edit a post; comment and like it from the other account. Confirm counts update.
2. Save a post and confirm it appears only in that account's Saved screen.
3. Send a friend invitation from People and accept it from the recipient's account.
4. Exchange messages, mark them read as the recipient, and reload to check persistence.
5. Check friend and comment notifications, mark one read, and reload.
6. Disconnect and reconnect a browser. Confirm current data returns and manual Refresh works.
7. Remove the friendship. Confirm the conversation becomes unavailable in both accounts.
8. Set one member's `active` value to false in the SQL console. Confirm their next refresh removes access.
9. Check navigation, forms, and messages at a narrow viewport and using a keyboard.
10. With a slow network, start a Like action in Feed and switch to Saved before it completes. Confirm Saved still shows only saved posts afterward.
11. Change search text, tabs, and pages while live updates are connected. Confirm these view changes do not reconnect the realtime socket.
12. Confirm profile reads and profile insert responses contain no email, and direct reads of `community_accounts` are denied.
13. Keep a comment thread open, replace a comment from another account without changing the total count, and click Refresh. Confirm the replacement appears.
14. With a slow network, submit a post, comment, or message. Confirm its text field is disabled until the request finishes and that a failed submission preserves the text.

For signup failures, check email/password settings and the key's auth permissions.
For data failures, check the database name, migrations, and profile creation for the signed-in account.
For realtime failures, check key permissions, the manifest, and the exact allowed origin.
Restart `npm run dev` after editing `.env.local`.

**`tests/security.test.mjs`**

```javascript title="tests/security.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { statements } from '../scripts/write-migrations.mjs';

test('migrations and community permissions work without the reference project', async function security() {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt_sub',true),'')::uuid $$;
      CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt_email',true) $$;
      GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated,anon;`);
    // query() uses PostgreSQL's single-statement protocol: catches accidentally
    // combining statements in one migration, including on the second run.
    for (let run = 0; run < 2; run++) for (const [, sql] of statements) await db.query(sql);
    const alice = '10000000-0000-4000-8000-000000000001';
    const bob = '10000000-0000-4000-8000-000000000002';
    const eve = '10000000-0000-4000-8000-000000000003';
    async function as(id, email = `${id}@example.test`) {
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('request.jwt_sub',$1,false),set_config('request.jwt_email',$2,false)", [id,email]);
      await db.exec('SET ROLE authenticated');
    }
    async function rows(sql, args = []) { return (await db.query(sql,args)).rows; }
    await as(eve);
    await assert.rejects(db.query("INSERT INTO public.community_posts(body) VALUES('profile required')"));
    assert.equal((await rows('SELECT * FROM public.community_posts')).length,0);
    for (const id of [alice,bob,eve]) {
      await as(id);
      const [profile] = await rows('INSERT INTO public.community_members(display_name) VALUES($1) RETURNING *', [id]);
      assert.equal('email' in profile,false);
      await assert.rejects(db.query('SELECT email FROM public.community_members'));
      await assert.rejects(db.query('SELECT * FROM public.community_accounts'));
      await assert.rejects(db.query("UPDATE public.community_accounts SET email='forged@example.test'"));
      assert.equal((await rows('SELECT active FROM public.community_members WHERE id=$1',[id]))[0].active,true);
      assert.equal((await rows('SELECT public.community_is_member() AS joined'))[0].joined,true);
    }
    await assert.rejects(db.query('UPDATE public.community_members SET active=true'));
    await assert.rejects(db.query('UPDATE public.community_members SET active=false'));
    await as(alice);
    const profiles = await rows('SELECT * FROM public.community_members');
    assert.equal(profiles.length,3);
    assert.ok(profiles.every(function publicOnly(row) { return !('email' in row); }));
    const [post] = await rows("INSERT INTO public.community_posts(body) VALUES('Hello community') RETURNING id");
    await assert.rejects(db.query('INSERT INTO public.community_posts(body,author_id) VALUES($1,$2)', ['spoof',bob]));
    await as(bob);
    assert.equal((await rows('UPDATE public.community_posts SET body=$1 WHERE id=$2 RETURNING id',['hijacked',post.id])).length,0);
    await db.query('INSERT INTO public.community_likes(post_id) VALUES($1)',[post.id]);
    await db.query('INSERT INTO public.community_comments(post_id,body) VALUES($1,$2)',[post.id,'Great post']);
    await db.query('INSERT INTO public.community_bookmarks(post_id) VALUES($1)',[post.id]);
    const [counts] = await rows('SELECT like_count,comment_count FROM public.community_posts WHERE id=$1',[post.id]);
    assert.deepEqual(counts,{like_count:1,comment_count:1});
    await as(alice);
    assert.equal((await rows('SELECT * FROM public.community_bookmarks')).length,0);
    assert.equal((await rows('SELECT * FROM public.community_notifications')).length,1);
    await db.query('INSERT INTO public.community_friendships(recipient_id) VALUES($1)',[bob]);
    await assert.rejects(db.query('INSERT INTO public.community_messages(recipient_id,body) VALUES($1,$2)',[bob,'not friends yet']));
    assert.equal((await rows("UPDATE public.community_friendships SET status='accepted' RETURNING id")).length,0);
    await as(bob);
    assert.equal((await rows("UPDATE public.community_friendships SET status='accepted' RETURNING id")).length,1);
    await as(alice);
    const [message] = await rows('INSERT INTO public.community_messages(recipient_id,body) VALUES($1,$2) RETURNING id',[bob,'Hello Bob']);
    assert.equal((await rows('UPDATE public.community_messages SET is_read=true RETURNING id')).length,0);
    await assert.rejects(db.query('UPDATE public.community_messages SET body=$1',['tampered']));
    await as(eve);
    assert.equal((await rows('SELECT * FROM public.community_messages WHERE id=$1',[message.id])).length,0);
    assert.equal((await rows('SELECT * FROM public.community_friendships')).length,0);
    assert.deepEqual((await rows('SELECT id FROM public.community_inboxes')).map(function id(row) { return row.id; }),[eve]);
    await assert.rejects(db.query('INSERT INTO public.community_notifications(recipient_id,title) VALUES($1,$2)',[alice,'forged']));
    await as(bob);
    assert.equal((await rows('UPDATE public.community_messages SET is_read=true RETURNING id')).length,1);
    await assert.rejects(db.query('UPDATE public.community_messages SET is_read=false'));
    await as(alice,'changed@example.test');
    assert.equal((await rows('SELECT * FROM public.community_posts')).length,0);
    assert.equal((await rows('SELECT * FROM public.community_messages')).length,0);
    assert.equal((await rows('SELECT * FROM public.community_inboxes')).length,1);
    await as(bob);
    await db.query('DELETE FROM public.community_friendships');
    assert.equal((await rows('SELECT * FROM public.community_messages')).length,0);
    await assert.rejects(db.query('INSERT INTO public.community_messages(recipient_id,body) VALUES($1,$2)',[alice,'removed']));
    await db.exec('RESET ROLE');
    await db.query('UPDATE public.community_members SET active=false WHERE id=$1',[bob]);
    await as(bob);
    assert.equal((await rows('SELECT * FROM public.community_posts')).length,0);
    await assert.rejects(db.query("INSERT INTO public.community_posts(body) VALUES('revoked')"));
    await assert.rejects(db.query('UPDATE public.community_members SET active=true'));
    await assert.rejects(db.query("INSERT INTO public.community_members(display_name) VALUES('rejoin')"));
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.community_posts'));
  } finally { await db.close(); }
});
```


## 11. Deploy your app

After the checks pass, upload the publishable variables and deploy the frontend:

```bash
volcano cloud variables deploy --file .env.local
volcano cloud frontends deploy --name community --path . --variable-scope scoped \
  --variable NEXT_PUBLIC_VOLCANO_API_URL \
  --variable NEXT_PUBLIC_VOLCANO_ANON_KEY \
  --variable NEXT_PUBLIC_VOLCANO_DATABASE
volcano cloud config deploy --file volcano/volcano-config.yaml
volcano cloud frontends get community
```

Keep `.env.local` limited to the three frontend values from step 2.
Add the deployed frontend's exact origin to your allowed auth origins and repeat the two-account checks there.
See [frontend deployment](/cli/frontends) and [variable scopes](/cli/variables).

Extend your working app with the [Storage guide](/sdk/js/storage) for photo uploads or the [Realtime guide](/sdk/js/realtime) for additional patterns.
Image access should enforce active membership and file ownership before images become part of the feed.
