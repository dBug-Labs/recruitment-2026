import SiteNav from "@/app/_components/SiteNav";
import FitFinder from "./FitFinder";

const TITLE = "Find your domain — dBug Labs Domain Fit Finder";
const DESCRIPTION =
  "Not sure which dBug Labs domain suits you? Answer eight quick questions, then talk it through " +
  "with our AI advisor. It ranks all ten tech and corporate domains and explains the trade-offs " +
  "before you pick two on the application form.";

export const metadata = {
  title: "Find your domain",
  description: DESCRIPTION,
  alternates: { canonical: "/fit" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: "/fit",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function FitPage() {
  return (
    <main>
      <SiteNav />

      <section style={{ paddingTop: 72, paddingBottom: 80 }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div style={{ textAlign: "center", marginBottom: 34 }}>
            <div className="eyebrow">FIND YOUR FIT</div>
            <h1 className="display grit grit-ink" style={{ fontSize: 46, marginTop: 12 }}>
              Which two domains?
            </h1>
            <p style={{ color: "#a99bad", fontSize: 16.5, marginTop: 12, lineHeight: 1.65 }}>
              Eight questions, no wrong answers. You get a ranking, then you can argue with our
              advisor about it before you commit on the form.
            </p>
          </div>

          <FitFinder />
        </div>
      </section>
    </main>
  );
}
