import Hydrated from './hydrated';

export const metadata = { title: 'HLX Next.js compatibility fixture' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Hydrated />
        {children}
      </body>
    </html>
  );
}
