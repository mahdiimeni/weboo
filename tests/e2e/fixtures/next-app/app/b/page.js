import Link from 'next/link';

export default function ArticleB() {
  return (
    <main>
      <h1 id="title-b">Article B — English content on Next.js</h1>
      <p id="bp1">
        This is the first paragraph of article B, written in English so that the
        highlight path is exercised on plain left-to-right content too.
      </p>
      <p id="bp2">
        Client-side navigation must not break saving, restoring, or the storage
        key of a highlight created on this page.
      </p>
      <p>
        <Link id="to-a" href="/">Back to article A (client-side)</Link>
      </p>
    </main>
  );
}
