// Temporary closure control for the Muze Café ordering site.
//
// To take the café OFFLINE:  set CLOSED to true,  then redeploy.
// To bring it BACK ONLINE:   set CLOSED to false, then redeploy.
//
// While CLOSED is true, every customer-facing page (menu, cart, checkout,
// confirmation) shows the closure screen below. The /kitchen and /admin
// pages stay reachable so staff/owners can still sign in.
//
// You can edit the wording in CLOSURE without touching any other file.

export const CLOSED = true;

export const CLOSURE = {
  title: "We're temporarily closed",
  // Each string is rendered as its own paragraph.
  body: [
    "Muze Café has paused online ordering while we work on what's next.",
    "Thank you for every coffee run and kind word — we can't wait to welcome you back soon.",
  ],
  // Optional call-to-action button. Set ctaHref to null to hide it.
  footerText: "Looking for the workspace?",
  ctaLabel: "Visit Muze Office",
  ctaHref: "https://muzeoffice.com",
};
