// web/pages/index.js
import { useEffect, useState } from "react";

async function post(path, body) {
  const { csrf_token } = await fetch("/api/session/csrf").then((response) => response.json());
  const response = await fetch(`/api/session${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrf_token },
    body: JSON.stringify(body ?? {}),
  });
  return { ok: response.ok, body: await response.json() };
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/session/me")
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((body) => setUser(body.user));
  }, []);

  async function signIn(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await post("/login", { email: form.get("email"), password: form.get("password") });
    setError(result.ok ? "" : result.body.error);
    setUser(result.ok ? result.body.user : null);
  }

  async function signOut() {
    await post("/logout");
    setUser(null);
  }

  if (user) {
    return (
      <main>
        <p>Signed in as {user.email}</p>
        <button onClick={signOut}>Sign out</button>
      </main>
    );
  }
  return (
    <main>
      <form onSubmit={signIn}>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        <button type="submit">Sign in</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
