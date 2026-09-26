"use client";
import { useEffect } from "react";
import PageSkeleton from "./PageSkeleton";
export default function WorkspaceEntry() {
  useEffect(() => {
    const mode = localStorage.getItem("artwork-platform:last-workspace");
    location.replace(mode === "gallery" ? "/gallery/" : "/artist/");
  }, []);
  return <PageSkeleton page="artist" />;
}
