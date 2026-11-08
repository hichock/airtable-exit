"use client";
// Shown when a loader throws ("Could not load …"). Never an empty page that looks like no data.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="content">
      <div className="error-box" role="alert">
        <strong>{error.message.startsWith("Could not") ? error.message : "Could not load this page."}</strong>
        <p style={{ margin: "6px 0 10px" }}>Check your connection and try again. If it keeps happening, tell an admin{error.digest ? ` (reference ${error.digest})` : ""}.</p>
        <button className="btn btn-sm" type="button" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
