// Serves the site and relays Grokipedia, whose pages send no CORS headers and so cannot be read by a browser directly.
//   node scripts/serve.mjs [port]      ->  http://localhost:8080/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const PROXY_PREFIX = '/proxy/grokipedia/';

async function relay(slug, res) {
  try {
    const upstream = await fetch(`https://grokipedia.com/page/${encodeURIComponent(slug)}`, { headers: { 'User-Agent': 'alexandrpedia/0.1 (https://github.com/h1ddenpr0cess20/alexandrpedia)' } });
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'text/html', 'x-alexandrpedia-proxy': '1', 'cache-control': 'public, max-age=300' });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.writeHead(502, { 'content-type': 'text/plain', 'x-alexandrpedia-proxy': '1' });
    res.end(String(error.message));
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname.startsWith(PROXY_PREFIX)) return relay(decodeURIComponent(pathname.slice(PROXY_PREFIX.length)), res);
  const file = normalize(join(ROOT, pathname === '/' ? 'index.html' : decodeURIComponent(pathname)));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403); return res.end(); }
  try {
    const target = (await stat(file)).isDirectory() ? join(file, 'index.html') : file;
    res.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Alexandrpedia on http://localhost:${PORT}/`));
