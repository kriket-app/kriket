import { SITE_URL } from '$lib/site';

// The only crawlable pages: everything under /app sits behind auth and carries
// its own robots noindex. Served live (adapter-node); crawlers fetch it directly.
const PATHS = ['/', '/signin', '/signup'];

export function GET() {
	const urls = PATHS.map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n');
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
	return new Response(xml, { headers: { 'content-type': 'application/xml' } });
}
