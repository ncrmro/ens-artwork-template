"use client";
import dynamic from "next/dynamic";
const Platform = dynamic(() => import("./Platform"), {
  ssr: false,
  loading: () => (
    <main className="page">
      <p>Loading Artwork Commons…</p>
    </main>
  ),
});
const Demo = dynamic(() => import("./Demo"), {
  ssr: false,
  loading: () => (
    <main className="page">
      <p>Loading demo…</p>
    </main>
  ),
});
export default function PageClient({
  page,
  demo = false,
}: {
  page: string;
  demo?: boolean;
}) {
  return demo ? <Demo page={page} /> : <Platform page={page} />;
}
