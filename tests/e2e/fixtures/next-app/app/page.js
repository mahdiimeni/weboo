import Link from 'next/link';
import Rerender from './rerender';

export default function Home() {
  return (
    <main>
      <h1 id="title-a">صفحهٔ الف — Next.js fixture</h1>
      <div dir="rtl" lang="fa">
        <p id="p1">
          این بند نخست صفحهٔ الف است و متن آزمایشی آن برای هایلایت با ماوس انتخاب می‌شود.
        </p>
        <p id="p2">
          این بند دوم برای بررسی ذخیره و بازیابی هایلایت پس از رفرش واقعی صفحه است.
        </p>
        <Rerender />
      </div>
      <p>
        <Link id="to-b" href="/b">Go to article B (client-side)</Link>
        {' | '}
        <Link id="to-c" href="/c">Go to article C (delayed content)</Link>
      </p>
    </main>
  );
}
