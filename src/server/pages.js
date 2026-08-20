/* The council website's service pages.
 *
 * Rendered on the server from SERVICES rather than written out as static HTML files, for one
 * reason: the same array is what Ava answers from. A hand-written waste page would drift from
 * her knowledge the first time either was edited, and a player who is told one thing by the
 * page and another by the assistant learns that the game is broken rather than that the model
 * is steerable.
 *
 * These pages are ordinary published council information. NOTHING RESTRICTED GOES HERE — the
 * staff chat and the directory are what Act Two is for, and putting any of it on a public page
 * would hand over the act for free.
 */

import { SERVICES } from '../game/ava.js';

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SERVICE_PAGES = SERVICES.filter((s) => !s.href);

export function findService(slug) {
  return SERVICE_PAGES.find((s) => s.slug === slug) || null;
}

/* A fact reads as "Label: detail" often enough to be worth splitting, and a leading bold label
 * is what makes a council page skimmable. Only split on a colon inside the first few words,
 * so "Report potholes, illegal dumping, ..." stays one sentence. */
function renderItem(text) {
  const at = text.indexOf(': ');
  if (at > 0 && at < 34) {
    return `<div class="fact"><dt>${escape(text.slice(0, at))}</dt><dd>${escape(text.slice(at + 2))}</dd></div>`;
  }
  return `<div class="fact"><dd class="lead">${escape(text)}</dd></div>`;
}

function nav(current) {
  return SERVICES.map((s) => {
    const href = s.href || `/services/${s.slug}`;
    const here = s.slug === current ? ' class="here" aria-current="page"' : '';
    return `<a href="${href}"${here}>${escape(s.nav)}</a>`;
  }).join('\n          ');
}

/* The council home page.
 *
 * Generated for the same reason the service pages are: its cards describe the services Ava
 * answers about, and a card that promises something she has never heard of is the fiction
 * breaking. The staff portal link stays in the navigation exactly where it has always been —
 * Act Three depends on it being findable and unremarkable. */
export function renderCouncilHome() {
  const cards = SERVICE_PAGES.map(
    (s) => `<a class="card" href="/services/${s.slug}">
          <h3>${escape(s.nav)}</h3>
          <p>${escape(s.blurb)}</p>
          <span class="card-more">Read more</span>
        </a>`,
  ).join('\n        ');

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sandbox Shire Council</title>
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/walkthrough.css">
</head>
<body>
  <div class="council">
    <header class="site-header">
      <div class="wrap header-inner">
        <a class="brand" href="/council.html">
          <span class="crest" aria-hidden="true">○</span>
          <div>
            <strong>Sandbox Shire</strong>
            <span class="tagline">Council</span>
          </div>
        </a>
        <nav class="site-nav" aria-label="Main navigation">
          ${nav(null)}
          <a href="/staff.html">Staff portal</a>
        </nav>
      </div>
    </header>

    <section class="hero">
      <div class="wrap">
        <h1>Welcome to Sandbox Shire</h1>
        <p>We provide local services for residents and businesses across our coastal community. Ava, our online assistant, can help with everyday council enquiries.</p>
        <div class="hero-actions">
          <a class="btn" href="/services/rates">Pay my rates</a>
          <a class="btn btn-ghost" href="/services/waste">Find my bin day</a>
        </div>
      </div>
    </section>

    <main class="wrap">
      <h2 class="section-title">Popular services</h2>
      <div class="cards">
        ${cards}
      </div>
    </main>

    <footer class="site-footer">
      <div class="wrap">
        <p>Sandbox Shire Council · PO Box 100, Port Sandbox · 1300 000 000</p>
        <p class="fine">This is a training simulation. Sandbox Shire is not a real council and all data shown is fictional.</p>
        <p><a href="/">Back to the control screen</a></p>
      </div>
    </footer>
  </div>

  <script type="module" src="/app.js"></script>
  <script type="module" src="/walkthrough.js"></script>
</body>
</html>
`;
}

export function renderServicePage(service) {
  const others = SERVICE_PAGES.filter((s) => s.slug !== service.slug);

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(service.title)} — Sandbox Shire Council</title>
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/walkthrough.css">
</head>
<body>
  <div class="council">
    <header class="site-header">
      <div class="wrap header-inner">
        <a class="brand" href="/council.html">
          <span class="crest" aria-hidden="true">○</span>
          <div>
            <strong>Sandbox Shire</strong>
            <span class="tagline">Council</span>
          </div>
        </a>
        <nav class="site-nav" aria-label="Main navigation">
          ${nav(service.slug)}
          <a href="/staff.html">Staff portal</a>
        </nav>
      </div>
    </header>

    <nav class="crumbs wrap" aria-label="Breadcrumb">
      <a href="/council.html">Home</a> <span aria-hidden="true">›</span> <span>${escape(service.title)}</span>
    </nav>

    <main class="wrap service">
      <div class="service-main">
        <h1>${escape(service.title)}</h1>
        <p class="intro">${escape(service.blurb)}</p>
        <dl class="facts">
          ${service.items.map(renderItem).join('\n          ')}
        </dl>
        <div class="callout">
          <p><strong>Need help with this?</strong> Ask Ava, the assistant in the corner of this
          page, or call the customer service centre on 1300 000 000.</p>
        </div>
      </div>

      <aside class="service-aside">
        <h2>Other services</h2>
        <ul class="side-links">
          ${others.map((s) => `<li><a href="/services/${s.slug}">${escape(s.nav)}</a></li>`).join('\n          ')}
          <li><a href="/contact.html">Contact us</a></li>
        </ul>
        <div class="side-card">
          <h3>Customer service centre</h3>
          <p>Monday to Friday, 8.30am to 5pm<br>Closed public holidays</p>
          <p><strong>1300 000 000</strong></p>
        </div>
      </aside>
    </main>

    <footer class="site-footer">
      <div class="wrap">
        <p>Sandbox Shire Council · PO Box 100, Port Sandbox · 1300 000 000</p>
        <p class="fine">This is a training simulation. Sandbox Shire is not a real council and all data shown is fictional.</p>
        <p><a href="/">Back to the control screen</a></p>
      </div>
    </footer>
  </div>

  <script type="module" src="/app.js"></script>
  <script type="module" src="/walkthrough.js"></script>
</body>
</html>
`;
}
