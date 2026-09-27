// The /app subtree requires a session: it must always render on the server,
// never bake into a prerendered file. (The prerender crawler follows links
// from prerendered pages such as /offline; without this, crawling /app as an
// anonymous visitor writes a redirect-to-signin stub that would shadow SSR,
// signing everyone out on full page loads.)
export const prerender = false;
