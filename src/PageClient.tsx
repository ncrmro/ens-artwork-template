"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import PageSkeleton from "./PageSkeleton";
const Platform = lazy(() => import("./Platform"));
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
      {demo ? <Demo page={page} /> : <Platform page={page} />}
    </Suspense>
  );
}
