---
title: Database queries
description: Read and change Postgres rows through the Python SDK with filters, ordering, and pagination.
order: 3
---

Query an existing database and table using the signed-in user's permissions.
This example expects a `main` database with an `items` table containing `id`, `name`, and `status` columns, plus Row-Level Security policies that permit the user to read those rows.
Set the credentials described in the [quickstart](./README.md).

```python
import os

from volcano_sdk import VolcanoClient

client = VolcanoClient(
    anon_key=os.environ["VOLCANO_ANON_KEY"],
    api_url=os.environ.get("VOLCANO_API_URL", "https://api.volcano.dev"),
)
client.auth.sign_in(
    email=os.environ["VOLCANO_USER_EMAIL"],
    password=os.environ["VOLCANO_USER_PASSWORD"],
)
items = client.database("main").from_("items")
rows = items.select("id", "name").eq("status", "published").execute()
for row in rows:
    print(row["id"], row["name"])
```

`execute()` returns a list of row dictionaries, including an empty list when no rows match.
Builders are immutable; each chained operation returns a new builder, so a base query can be reused.
The following examples reuse an authenticated `client` and the same table.

## Filter, sort, and page through rows

```python
base = client.database("main").from_("items").select("id", "name")
rows = (
    base.ilike("name", "%volcano%")
    .in_("status", ["draft", "published"])
    .order("name")
    .order("id")
    .limit(20)
    .offset(40)
    .execute()
)
```

| Methods | Filter |
| --- | --- |
| `eq`, `neq` | Equal or not equal to a value |
| `gt`, `gte`, `lt`, `lte` | Compare values |
| `like`, `ilike` | Case-sensitive or case-insensitive SQL pattern; `%` matches any sequence |
| `is_("deleted_at", None)` | Match a SQL null |
| `is_("enabled", True)` | Match a SQL boolean |
| `in_("status", ["draft", "published"])` | Match a member of a list |

Use `select("*")` to return every column.
Pass `ascending=False` to `order()` for descending order.
Include a unique final sort column such as `id` when paging with `limit()` and `offset()`.

## Insert, update, and delete

```python
items = client.database("main").from_("items")
created = items.insert({"name": "Volcano", "status": "draft"}).execute()
item_id = created[0]["id"]
updated = items.update({"status": "published"}).eq("id", item_id).execute()
deleted = items.delete().eq("id", item_id).execute()
```

Mutations return a list of the affected rows.
Updates and deletes with no matches return an empty list.
They require at least one filter; Volcano rejects filterless updates and deletes.

## Handle authentication failures

Database reads and mutations refresh a rejected access token once when the captured session has a usable refresh token, then retry the same request.
HTTP 403 responses and network failures do not trigger this retry.
Mutations are never retried after an ambiguous transport failure.
Replacing or signing out the session during recovery raises `SessionChangedError` instead of replaying under another user.

For direct Postgres connections inside a Volcano function, `database_connection_string()` can derive a connection string from `DATABASE_URL` and a server-validated `user_id` while preserving its database target.
Passing a user ID applies that user's Row-Level Security context; omitting it requests service access.
Keep the resulting connection string private.
