import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pro-dev-skillset — one install, your entire dev lifecycle",
  description:
    "A portable Claude Code & Codex skill marketplace that maps every task to the right phase and skill — Define, Plan, Spec, Build, Verify, Review, Security, Ship.",
  metadataBase: new URL("https://pro-dev-skillset.dev"),
  openGraph: {
    title: "pro-dev-skillset",
    description: "One install. Your entire dev lifecycle, as skills.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
