---
title: Storage
description: Upload, download, list, move, and resume files using the Python SDK.
order: 4
---

Upload and read bytes from an existing `assets` bucket whose policies permit the signed-in user to access the object.
Set the [quickstart credentials](./README.md).

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
bucket = client.storage.from_("assets")
bucket.upload("examples/hello.txt", b"hello", content_type="text/plain")
assert bucket.download("examples/hello.txt") == b"hello"
print(bucket.download("examples/hello.txt", byte_range="bytes=1-3"))
```

Uploads accept bytes or a binary file-like object; downloads return bytes.
An omitted `content_type` uses `application/octet-stream`.
Explicit content types must be non-blank printable ASCII and may include MIME parameters.
The following examples reuse an authenticated `client` and `bucket`.

## List and manage objects

```python
page = bucket.list("examples", limit=100)
for object_ in page.objects:
    print(object_.name)
if page.next_cursor is not None:
    next_page = bucket.list("examples", limit=100, cursor=page.next_cursor)

copied = bucket.copy("examples/hello.txt", "examples/hello-copy.txt")
moved = bucket.move("examples/hello-copy.txt", "examples/hello-moved.txt")
removed = bucket.remove(["examples/hello-moved.txt"])
```

Copy preserves its source; move removes its source after creating the destination.
Object metadata and listing responses are immutable.
`remove()` accepts one path or a sequence and returns removed paths as a tuple.
It processes paths in order; a failure raises after earlier successful deletions.

## Control public visibility

```python
object_ = bucket.update_visibility("examples/hello.txt", is_public=True)
print(object_.public_url)
url = bucket.get_public_url("examples/hello.txt")
```

`update_visibility()` returns server-confirmed metadata; its `public_url` is populated only for a public object.
`get_public_url()` constructs a URL locally and does not check whether the object exists or is public.
Pass `is_public=False` to make an object private again.

## Upload a file in parts

```python
with open("video.mp4", "rb") as source:
    uploaded = bucket.upload_resumable(
        "videos/demo.mp4",
        source,
        content_type="video/mp4",
        on_progress=lambda sent, total: print(f"{sent}/{total}"),
    )
print(uploaded.name)
```

The helper creates an upload session, uses the server-selected part size, and completes the object.
It streams seekable files and spools non-seekable inputs to a temporary file with bounded reads.
Progress runs after each successful part with cumulative uploaded bytes and total size.
If a part or progress callback fails, the helper attempts to abort and raises the original error.

## Resume or cancel an upload session

For application-managed recovery, retain the session ID and upload progress yourself:

```python
payload = b"example file"
session = bucket.create_upload_session(
    "examples/resumable.txt",
    total_size=len(payload),
    content_type="text/plain",
)
for offset in range(0, len(payload), session.part_size):
    bucket.upload_part(
        "examples/resumable.txt",
        session_id=session.session_id,
        part_number=offset // session.part_size + 1,
        data=payload[offset : offset + session.part_size],
    )
status = bucket.get_upload_session(
    "examples/resumable.txt", session_id=session.session_id
)
print(status.parts_uploaded, status.bytes_uploaded)
completed = bucket.complete_upload_session(
    "examples/resumable.txt", session_id=session.session_id
)
```

The server returns the part size, total part count, and session expiration.
`get_upload_session()` exposes uploaded-part metadata to help an application resume.
Uploading the same part number again replaces that part.
To abandon an unfinished session, call `bucket.abort_upload_session(path, session_id=session_id)`; this discards its uploaded parts without publishing an object. Further session-status requests report not found.

Authenticated storage requests refresh and retry once after an explicit HTTP 401 when a refresh token is available.
They preserve the original request and session ownership, and do not retry ambiguous network failures or HTTP 403 responses.
