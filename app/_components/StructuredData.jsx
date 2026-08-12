import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, absoluteUrl } from "@/lib/site";

/**
 * JSON-LD for the landing page.
 *
 * Two graphs only, both of which we can state truthfully: who the org is, and
 * what the site is. No JobPosting (this is a student club, not employment) and
 * no FAQPage (there is no FAQ section on the page to back it up) — marking up
 * content that isn't visible is what gets structured data ignored or penalised.
 */
export default function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: "dBug Labs SRM",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/logo.png"),
        },
        description:
          "A student technology and creative community at SRM building real projects across " +
          "ten domains — web, AI/ML, app, and more, alongside corporate and creative teams.",
        knowsAbout: [
          "Web Development",
          "AI / ML",
          "App Development",
          "Cybersecurity",
          "UI/UX and Creatives",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: `${SITE_NAME} — Brand New Day`,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en-IN",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is inert data, not author-controlled markup.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
