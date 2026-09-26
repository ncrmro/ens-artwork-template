"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import PageSkeleton from "./PageSkeleton";
const Platform = lazy(() => import("./Platform"));
const Browse = lazy(() => import("./Browse"));
const Admin = lazy(() => import("./Admin"));
const Demo = lazy(() => import("./Demo"));
export default function PageClient({
  page,
  demo = false,
}: {
  page: string;
  demo?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fallback = <PageSkeleton page={page} />;
  if (!mounted) return fallback;
  return (
    <Suspense fallback={fallback}>
      {page === "admin" ? (
        <Admin />
      ) : page.startsWith("browse-") ? (
        <Browse kind={page.slice(7)} />
      ) : demo ? (
        <Demo page={page} />
      ) : (
        <Platform page={page} />
      )}
    </Suspense>
  );
}
