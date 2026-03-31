/* SPDX-License-Identifier: MPL-2.0 */

import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import ThemedImage from "@theme/ThemedImage";
import styles from "./index.module.css";

function HomepageHeader() {
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <div className={clsx(styles.sectionContent, styles.heroContent)}>
          <Heading as="h1" className={styles.heroLogoHeading}>
            <ThemedImage
              alt="HoodleFinance"
              className={styles.heroLogo}
              sources={{
                light: "/img/hoodlefinance/light/hero-art.svg",
                dark: "/img/hoodlefinance/dark/hero-art.svg",
              }}
            />
          </Heading>
          <p className={styles.heroText}>
            Market data for U.S. and international listings, identifier lookups,
            and built-in currency conversion for Google Sheets™.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/docs/">
              Read the docs
            </Link>
            <Link
              className="button button--secondary button--lg"
              to="/demo"
            >
              View demo sheet
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="HoodleFinance brings market data for U.S. and international listings, identifier lookups, and built-in currency conversion to Google Sheets™."
    >
      <HomepageHeader />
      <main>
        <section className={styles.section}>
          <div className="container">
            <div className={styles.sectionContent}>
              <div className={styles.featureGrid}>
                <div className={styles.card}>
                  <Heading as="h2">International Coverage</Heading>
                  <p>
                    HoodleFinance is built for sheets that need more than
                    familiar U.S. tickers, including supported exchange-prefixed
                    inputs, Yahoo-style symbols, and direct ISIN lookups.
                  </p>
                </div>
                <div className={styles.card}>
                  <Heading as="h2">Identifier Lookups</Heading>
                  <p>
                    In addition to quote fields, the add-on can resolve values
                    such as symbol, exchange, and ISIN across supported routes.
                  </p>
                </div>
                <div className={styles.card}>
                  <Heading as="h2">Currency Conversion</Heading>
                  <p>
                    <code>price@USD</code>-style output helps normalize mixed-
                    currency sheets without separate FX helper columns.
                  </p>
                </div>
              </div>
              <div className={styles.heroPreview}>
                <img
                  src="/img/hoodlefinance/demo-screenshot.png"
                  alt="HoodleFinance demo spreadsheet"
                  className={styles.previewImage}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
