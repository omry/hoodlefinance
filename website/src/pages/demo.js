/* SPDX-License-Identifier: MPL-2.0 */

import { useEffect } from "react";
import Link from "@docusaurus/Link";
import Head from "@docusaurus/Head";
import Layout from "@theme/Layout";
import publicDemoLink from "../../../docs/demo-sheet/public-demo-link.json";

const DEMO_SHEET_URL = String(publicDemoLink.publicUrl || "").trim();

export default function DemoRedirectPage() {
  useEffect(function () {
    if (typeof window !== "undefined" && DEMO_SHEET_URL) {
      window.location.replace(DEMO_SHEET_URL);
    }
  }, []);

  if (!DEMO_SHEET_URL) {
    return (
      <Layout title="Demo">
        <main className="container margin-vert--xl">
          <h1>Demo sheet unavailable</h1>
          <p>
            The public demo sheet link is not configured right now. Browse the{" "}
            <Link to="/docs">docs</Link> while this is being repaired.
          </p>
        </main>
      </Layout>
    );
  }

  return (
    <Layout title="Demo">
      <Head>
        <meta httpEquiv="refresh" content={"0;url=" + DEMO_SHEET_URL} />
        <link rel="canonical" href={DEMO_SHEET_URL} />
      </Head>
      <main className="container margin-vert--xl">
        <h1>Redirecting to the demo sheet</h1>
        <p>
          If the redirect does not start automatically, open the{" "}
          <Link href={DEMO_SHEET_URL}>public demo sheet</Link>.
        </p>
      </main>
    </Layout>
  );
}
