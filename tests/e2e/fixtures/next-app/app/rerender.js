'use client';

import { useState } from 'react';

/* Simulates a React re-render that REMOVES the injected <mark> elements:
   bumping the key remounts the whole <p>, destroying any DOM the extension
   wrapped inside it. The extension must re-apply the highlight afterwards. */
export default function Rerender() {
  const [n, setN] = useState(0);
  return (
    <>
      <p key={n} id="rw">
        بند بازرندر با هر بار فشردن دکمه از نو ساخته می‌شود و هایلایت آن باید بازگردد.
      </p>
      <button id="rerender" type="button" onClick={() => setN((v) => v + 1)}>
        Re-render paragraph ({n})
      </button>
    </>
  );
}
