import "../src/style.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Artwork Commons — Artists, galleries, one shared history",
  description:
    "Give physical artwork a lasting record of its artist, exhibitions, collectors and terms. Create collections and curate exhibitions.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
