export function CollectionSkeleton() {
  return (
    <div className="catalogue" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div className="panel" key={i}>
          <div className="skeleton skeleton-image" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
        </div>
      ))}
    </div>
  );
}
export default function PageSkeleton({ page }: { page: string }) {
  const gallery = page === "gallery" || page === "exhibition";
  return (
    <main
      className={"page workspace-" + (gallery ? "gallery" : "artist")}
      aria-busy="true"
      aria-label={gallery ? "Loading exhibitions" : "Loading artwork"}
    >
      <span className="sr-only" role="status">
        {gallery ? "Loading exhibitions" : "Loading artwork"}
      </span>
      <div aria-hidden="true">
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-heading" />
        <div className="skeleton skeleton-title" />
      </div>
      {page === "artwork" ? (
        <div className="art-layout" aria-hidden="true">
          <div className="skeleton skeleton-image" />
          <div className="panel">
            <div className="skeleton skeleton-heading" />
            <div className="skeleton skeleton-line" />
          </div>
        </div>
      ) : (
        <CollectionSkeleton />
      )}
    </main>
  );
}
