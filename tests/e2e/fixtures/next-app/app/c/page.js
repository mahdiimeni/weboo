'use client';

import { useEffect, useState } from 'react';

/* The paragraph appears only 2.5s after mount — like a streamed/resolved
   section. A highlight saved here must survive a reload where the text is
   not in the DOM at boot (orphan retry path). */
export default function ArticleC() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 2500);
    return () => clearTimeout(t);
  }, []);
  return (
    <main>
      <h1 id="title-c">Article C — delayed content</h1>
      <div dir="rtl" lang="fa">
        {late ? (
          <p id="late-p">
            این بند دیرهنگام ظاهر می‌شود و هایلایت ذخیره‌شده روی آن باید پس از رفرش دوباره برگردد.
          </p>
        ) : (
          <p id="wait-p">در انتظار بند دیرهنگام…</p>
        )}
      </div>
    </main>
  );
}
