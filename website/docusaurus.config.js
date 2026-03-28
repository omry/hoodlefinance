/* SPDX-License-Identifier: MPL-2.0 */

// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { themes as prismThemes } from "prism-react-renderer";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "HoodleFinance",
  tagline: "Market data for U.S. and international listings in Google Sheets",
  favicon: "img/hoodlefinance/light/icon.svg",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  headTags: [
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        type: "image/svg+xml",
        href: "/img/hoodlefinance/light/icon.svg",
        media: "(prefers-color-scheme: light)",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        type: "image/svg+xml",
        href: "/img/hoodlefinance/dark/icon.svg",
        media: "(prefers-color-scheme: dark)",
      },
    },
  ],

  // Set the production url of your site here
  url: "https://hoodlefinance.com",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "omry",
  projectName: "hoodlefinance",

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
          editUrl: "https://github.com/omry/hoodlefinance/tree/main/website/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/hoodlefinance/light/social-share-1200x630.png",
      metadata: [
        {
          property: "og:type",
          content: "website",
        },
      ],
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: "HoodleFinance",
        logo: {
          alt: "HoodleFinance logo",
          src: "img/hoodlefinance/light/icon.svg",
          srcDark: "img/hoodlefinance/dark/icon.svg",
        },
        items: [
          {
            type: "docSidebar",
            sidebarId: "tutorialSidebar",
            position: "left",
            label: "Docs",
          },
          {
            href: "https://github.com/omry/hoodlefinance",
            label: "GitHub",
            position: "left",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Support & Policy",
            items: [
              {
                label: "Support",
                to: "/support",
              },
              {
                label: "Privacy Policy",
                to: "/privacy-policy",
              },
              {
                label: "Terms of Service",
                to: "/terms-of-service",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "Docs",
                to: "/docs",
              },
              {
                label: "GitHub",
                href: "https://github.com/omry/hoodlefinance",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} HoodleFinance. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
