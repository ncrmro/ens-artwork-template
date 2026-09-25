import "../src/style.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Artwork Commons — Artists, galleries, one shared history",
  description:
    "Create an artist collection or gallery exhibition under your own ENS name. Independent ownership, shared provenance.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
