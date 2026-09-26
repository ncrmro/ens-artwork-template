import SiteHeader from "../../src/SiteHeader";
const source =
  "https://github.com/ncrmro/ens-artwork-template/blob/main/contracts/";
export default function Docs() {
  return (
    <>
      <SiteHeader />
      <main className="page docs-page">
        <p className="eyebrow">UNDER THE SURFACE</p>
        <h1>
          One artwork.
          <br />
          <em>Independent participants.</em>
        </h1>
        <p className="intro">
          A guide to the records, contracts and permissions behind Artwork
          Commons. Use the story demo to explain the experience, then this page
          to examine how it works.
        </p>
        <div className="actions">
          <a className="button" href="/demo/artwork/?id=blue-mountain">
            Follow Blue Mountain ↗
          </a>
          <a className="button" href="#contracts">
            Contract map
          </a>
          <a className="button" href="#terms">
            Terms & enforcement
          </a>
          <a className="button" href="#demo">
            Demo environments
          </a>
        </div>
        <section className="panel">
          <h2>The same work, across different contexts</h2>
          <p>
            In the illustrative story, EON MUN creates Blue Mountain. Alex Chen
            buys it, two galleries include it in exhibitions, and Rowan Ellis
            later buys it from Alex. Its artist attribution and canonical
            artwork terms remain attached to the original work. A later
            exhibition records a loan without implying another sale.
          </p>
          <p>
            Each gallery references the artwork’s registry and token. It does
            not mint a replacement identity. Works by Mika Sato can appear in
            the same exhibition while retaining their separate artist records.
          </p>
        </section>
        <section className="section" id="contracts">
          <h2>The contract map</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Responsibility</th>
                  <th>Authority</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <a href={source + "LifecycleRegistry.sol"}>
                      ParticipantRegistry
                    </a>
                  </td>
                  <td>
                    Links an artist’s art registry or a gallery’s exhibition
                    registry beneath their name.
                  </td>
                  <td>The participant controls attachment.</td>
                </tr>
                <tr>
                  <td>
                    <a href={source + "LifecycleRegistry.sol"}>
                      ArtworkRegistry
                    </a>
                  </td>
                  <td>
                    Issues an ERC-1155 singleton, immutable genesis, royalty
                    terms and owner presentation.
                  </td>
                  <td>
                    The original artist issues; the current owner controls
                    owner-derived presentation.
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href={source + "ArtResolver.sol"}>ArtResolver</a>
                  </td>
                  <td>
                    Publishes the artwork or exhibition manifest contenthash and
                    metadata URI.
                  </td>
                  <td>Records are established by the creating registry.</td>
                </tr>
                <tr>
                  <td>
                    <a href={source + "GalleryRegistry.sol"}>GalleryRegistry</a>
                  </td>
                  <td>
                    Creates exhibitions, receives submissions and records the
                    gallery’s acceptance.
                  </td>
                  <td>Only the gallery accepts or declines submissions.</td>
                </tr>
                <tr>
                  <td>
                    <a href={source + "MandateRegistry.sol"}>MandateRegistry</a>
                  </td>
                  <td>
                    Records scope, expiry, minimum price, commission and gallery
                    acceptance.
                  </td>
                  <td>
                    The current owner grants authority; an ownership change
                    invalidates old mandates.
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href={source + "SimpleSettlement.sol"}>
                      SimpleSettlement
                    </a>
                  </td>
                  <td>
                    Settles direct and gallery sales, transfers ownership and
                    credits withdrawable proceeds.
                  </td>
                  <td>
                    Checks the listing, owner, price and applicable mandate
                    before settlement.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="section">
          <h2>What ENSv2 contributes</h2>
          <p>
            Hierarchical registries let each participant manage their own
            namespace. An artist’s collection and a gallery’s exhibitions remain
            independently controlled, while their records can reference each
            other.
          </p>
          <pre className="architecture">{`eonmun.eth\n└── art → ArtworkRegistry\n    └── blue-mountain → ArtResolver → IPFS manifest\n\natelier.eth\n└── exhibitions → GalleryRegistry\n    └── tokyo → exhibition manifest + artwork references`}</pre>
          <p>
            The platform checks name ownership or delegated subregistry
            permission before linking a participant registry. ArtworkRegistry
            builds on ENSv2’s PermissionedRegistry and ERC1155Singleton. Names
            resolve through the registry hierarchy to a contenthash; the
            original artwork record remains identifiable as ownership changes.
          </p>
          <p>
            Name permissions and gallery mandates are separate. Permission to
            manage a name does not itself authorize a gallery sale. Application
            mandates are scoped to the artwork, current owner and ownership
            epoch.
          </p>
          <p>
            <a href="https://github.com/ensdomains/contracts-v2/tree/48b3e2d39513b9dd32ef1850877a29009bc807b9">
              Pinned ENSv2 source
            </a>{" "}
            · <a href="https://eips.ethereum.org/EIPS/eip-1155">ERC-1155</a> ·{" "}
            <a href="https://eips.ethereum.org/EIPS/eip-2981">ERC-2981</a>
          </p>
        </section>
        <section className="section" id="terms">
          <h2>One canonical terms record per artwork</h2>
          <p>
            The story demo stores one terms record per artwork. Every exhibition
            points back to it. Artist resale royalties belong to the artwork;
            gallery commission belongs to a particular mandate or sale. They are
            not interchangeable.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Clause</th>
                  <th>Demo presentation</th>
                  <th>Current contract behavior</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Artist royalty</td>
                  <td>5% of a supported resale to the original artist.</td>
                  <td>
                    Royalty recipient and basis points are immutable genesis
                    fields. SimpleSettlement accounts for royalties on supported
                    resales; the original artist’s primary sale is exempt.
                  </td>
                </tr>
                <tr>
                  <td>Holding period</td>
                  <td>
                    180 days after a purchase, with a proposed next-sale date.
                  </td>
                  <td>
                    Illustrative agreement clause only. No holding-period check
                    is implemented.
                  </td>
                </tr>
                <tr>
                  <td>Artist purchase option</td>
                  <td>
                    Before a resale below 0.4 ETH, offer the artist the same
                    price and terms, with 14 days to respond.
                  </td>
                  <td>
                    Illustrative agreement clause only. Notification, exercise,
                    expiry and sale-blocking logic are not implemented.
                  </td>
                </tr>
                <tr>
                  <td>Gallery commission</td>
                  <td>Agreed separately; 10% in the example sale.</td>
                  <td>
                    Stored in the mandate and credited on gallery settlement.
                    Direct sales do not charge gallery commission.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The existing genesis schema includes an optional agreementURI and
            agreementHash pair for identifying an agreement document. The
            expanded story’s clauses currently live in demo state; they are not
            newly deployed agreement contracts. A production terms document
            would need its own pinned content, hash and matching implementation.
          </p>
          <p>
            ERC-2981 reports royalty information; it does not enforce payment
            across every marketplace or transfer. Token ownership and an
            exhibition statement also do not independently verify physical
            custody or legal title.
          </p>
        </section>
        <section className="section">
          <h2>Reading the history</h2>
          <p>
            Creation, exhibition acceptance and purchases are different events.
            The story labels them with dates, participants and links to the
            relevant work or exhibition. A purchase changes the current owner;
            an exhibition does not. Older exhibitions remain part of the work’s
            history.
          </p>
          <p>
            The contract layer exposes issuance, submission, decision,
            settlement and transfer events. A production history reader must
            index those events across relevant registries and preserve their
            transaction evidence. The richer multi-artist timeline shown in the
            story demo is curated fictional data, not a claim that those sales
            happened on Sepolia.
          </p>
        </section>
        <section className="section" id="demo">
          <h2>Choose the right demo</h2>
          <div className="split">
            <article className="panel">
              <h3>Story demo</h3>
              <p>
                Two artists, two galleries, multiple exhibitions and successive
                collectors. Session storage holds the records. No wallet,
                payment or chain transaction is involved.
              </p>
              <a href="/demo/artwork/?id=blue-mountain">Open the story ↗</a>
            </article>
            <article className="panel">
              <h3>Local contract demo</h3>
              <p>
                The separately configured Anvil environment uses the pinned
                official ENSv2 deployment on chain 31337. It seeds eonmun.eth
                and atelier.eth and supports actual local transactions for
                creation, submission, acceptance and purchase. Its seed is
                separate from the richer story data.
              </p>
              <a href="https://github.com/ncrmro/ens-artwork-template/blob/main/docs/local-demo.md">
                Local setup and verification ↗
              </a>
            </article>
          </div>
          <p>
            Public wallet workflows use Ethereum Sepolia. A successful local
            test or fictional story entry is not evidence of a public-chain
            transaction. Inspect the connected environment and transaction
            receipts for live demonstrations.
          </p>
        </section>
      </main>
      <footer>
        <a href="/">Back to the platform</a>
        <a href="https://github.com/ncrmro/ens-artwork-template">
          Source repository ↗
        </a>
      </footer>
    </>
  );
}
