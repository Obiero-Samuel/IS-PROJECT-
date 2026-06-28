import Link from "next/link";
import NavBar from "@/components/NavBar";

export default function Home() {
  return (
    <>
      <NavBar />
      <main className="main">
        <div className="container stack">
          <section className="card stack">
            <h1 className="title">Civic Issues — Resident Portal</h1>
            <p className="subtitle">
              Report issues, track progress, and support community priorities through upvotes.
            </p>
            <div className="row">
              <Link href="/reports/new" className="primary">Submit a report</Link>
              <Link href="/reports" className="ghost">View public reports</Link>
            </div>
          </section>

          <section className="grid two">
            <article className="card stack">
              <h2>Resident actions</h2>
              <p className="muted">Create and manage your issue submissions.</p>
              <div className="stack">
                <Link href="/register" className="ghost">Create account</Link>
                <Link href="/login" className="ghost">Login</Link>
                <Link href="/my-reports" className="ghost">My reports</Link>
              </div>
            </article>

            <article className="card stack">
              <h2>Community visibility</h2>
              <p className="muted">Explore reports on an interactive map and support issues via upvotes.</p>
              <div className="stack">
                <Link href="/ward-map" className="ghost">Public ward map view</Link>
                <Link href="/reports" className="ghost">Public reports + upvote</Link>
              </div>
            </article>
          </section>
        </div>
      </main>
    </>
  );
}
