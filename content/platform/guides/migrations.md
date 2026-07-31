---
title: "Database Migrations"
description: "This guide explains how to manage database migrations using the Volcano CLI."
---

This guide explains how to manage database migrations using the Volcano CLI.

## Overview

Volcano provides a simple way to run SQL migrations against your databases. Migrations are SQL files stored in your project's `volcano/migrations/` directory and are executed in alphabetical order.

## File Structure

Place your migration files in the `volcano/migrations/` directory:

```text
your-project/
  volcano/
    migrations/
      001_create_users.sql
      002_add_posts.sql
      003_enable_rls.sql
```

**Best practices:**
- Use numbered prefixes (`001_`, `002_`) to maintain execution order
- Use descriptive names that indicate what the migration does
- Keep migrations small and focused on a single change

## Running Migrations

### Cloud Deployment

To deploy migrations to your cloud database, use `volcano cloud databases migration up`:

```bash
# Deploy all migrations to a specific database
volcano cloud databases migration up --all -d mydb

# Deploy a specific migration
volcano cloud databases migration up -d mydb -f 001_create_users

# Deploy using full path
volcano cloud databases migration up -d mydb -f volcano/migrations/001_create_users.sql
```

The `-d` (or `--database`) flag is **required**, and you must pass either `--all`/`-a` or `-f`/`--file`.

### Local Development

For local development, use the top-level `volcano migrations deploy` command. When you run `volcano start`, a default database named `app` is created automatically:

```bash
# Deploy all migrations to the default "app" database
volcano migrations deploy --all -d app

# Deploy a specific migration
volcano migrations deploy -d app -f 001_create_users
```

The `-d` (or `--database`) flag is **required** for local development as well, along with `--all`/`-a` or `-f`/`--file`. This allows you to create multiple databases in local mode if needed.

## Requirements

### Cloud Migrations

- **psql**: The PostgreSQL client must be installed and available in your PATH
- **Database**: The target database must exist and be in `active` status
- **Authentication**: You must be logged in with `volcano login`

### Local Migrations

- **Docker**: Must be running with the Volcano containers started
- **Volcano running**: Run `volcano start` before deploying migrations

## Error Handling

Migrations are executed with `ON_ERROR_STOP=1`, meaning:
- If a migration fails, execution stops immediately
- Subsequent migrations are not executed
- You should fix the error and re-run

Common error scenarios:

```bash
# Database doesn't exist
$ volcano cloud databases migration up --all -d nonexistent
Error: Failed to get database 'nonexistent': HTTP 404: database not found

# Database not ready
$ volcano cloud databases migration up --all -d mydb
Error: Database 'mydb' is not active (status: provisioning)

# Migration not found
$ volcano cloud databases migration up -d mydb -f missing_migration
Error: Migration 'missing_migration' not found in volcano/migrations/
Available migrations: 001_create_users.sql, 002_add_posts.sql
```

## Migration Examples

### Creating a Table

```sql
-- volcano/migrations/001_create_notes.sql
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
```

### Enabling Row Level Security

```sql
-- volcano/migrations/002_enable_rls.sql
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notes
CREATE POLICY notes_select_own ON notes
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert notes for themselves
CREATE POLICY notes_insert_own ON notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Adding a Column

```sql
-- volcano/migrations/003_add_pinned.sql
ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
```

## Important Notes

**No migration tracking**: Volcano does not track which migrations have been run. You are responsible for:
- Not re-running migrations that have already been applied
- Managing your migration history
- Using idempotent statements (`IF NOT EXISTS`, etc.) when possible

For production applications requiring migration tracking, consider using dedicated tools like:
- [Flyway](https://flywaydb.org/)
- [Liquibase](https://www.liquibase.org/)
- [golang-migrate](https://github.com/golang-migrate/migrate)

## See Also

- [Creating Databases](../databases/creating-databases.md)
- [Row Level Security](../databases/row-level-security.md)
- [Database Roles](../databases/database-roles.md)
