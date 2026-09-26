import { withEonmunArtworks } from "./eonmun-import.js";
// Shared staged and real-chain catalogue. Historical events are explicitly fictional.
const profiles = {
  eonmun: {
    kind: "artist",
    name: "EON MUN · demo editions",
    images: ["cypresses"],
  },
  davinci: {
    kind: "artist",
    name: "Leonardo da Vinci · demo editions",
    images: ["mona-lisa"],
  },
  vangogh: {
    kind: "artist",
    name: "Vincent van Gogh · demo editions",
    images: ["straw-hat", "cypresses"],
  },
  louvre: { kind: "gallery", name: "Louvre · testnet demo" },
  mfah: { kind: "gallery", name: "MFAH · testnet demo" },
  uffizi: { kind: "gallery", name: "Uffizi · testnet demo" },
};
export const knownNames = Object.keys(profiles).map((n) => n + ".eth");
export function namedCatalogue(names, sources) {
  const participants = names
    .filter((n) => n !== "ncrmro.eth")
    .sort()
    .map((parent) => {
      const id = parent.split(".")[0];
      const p = profiles[id] || {
        kind: "artist",
        name: parent + " · demo editions",
        images: ["mona-lisa"],
      };
      return {
        id,
        parent,
        name: p.name,
        kind: p.kind,
        establishedAt: "2026-01-01",
        images: p.images || [],
      };
    });
  const works = participants
    .filter((p) => p.kind === "artist")
    .flatMap((p) =>
      p.images.map((image, i) => {
        const source = sources.find((s) => s.id === image);
        return {
          id: p.id + "-" + image,
          title: source.title + " — demo edition",
          artist: p.name,
          owner: p.name,
          medium: "Digital study of a public-domain painting",
          dimensions: "Reference image; no physical title conveyed",
          price: "0.001",
          variant: i,
          termsId: "standard-artwork-v1",
          createdAt: "2026-01-01",
          sourceImage: image,
          imageSource: source.source,
          imageArtist: source.artist,
          originalDate: source.date,
          imageLicense: source.license,
          description:
            "Testnet demonstration edition. Not an original painting, institutional affiliation, or claim of physical ownership.",
        };
      }),
    );
  const shows = participants
    .filter((p) => p.kind === "gallery")
    .map((p) => ({
      id: p.id + "-open-collection",
      title: "Open Collection · " + p.parent,
      gallery: p.name,
      description:
        "A fictional cross-collection exhibition for the testnet demo; not a real exhibition history.",
      occurredAt: "2026-02-01",
      dates: "February 2026 · fictional demo",
      status: "current",
      works: works.map((w) => w.id),
    }));
  const history = works.flatMap((w) => [
    {
      workId: w.id,
      date: w.createdAt,
      title: "Created demo edition",
      detail:
        "Testnet edition based on " +
        w.imageArtist +
        "’s public-domain image; original work dated " +
        w.originalDate +
        ". Source: " +
        w.imageSource,
    },
  ]);
  return withEonmunArtworks({
    participants,
    works,
    shows,
    history,
    submissions: [],
    terms: {},
  });
}
