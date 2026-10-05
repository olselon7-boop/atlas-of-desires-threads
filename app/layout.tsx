import type { ReactNode } from "react";

export const metadata = {
  title: "Atlas of Desires — Threads API",
  description: "Threads API integration layer for Atlas of Desires",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "48px auto", padding: "0 20px" }}>
        {children}
      </body>
    </html>
  );
}
