#!/usr/bin/env python3
"""Serve the site on this computer as the host does: files as they are, and the page itself for a video's own address
(/watch/<title>), which isn't a file. Cloudflare Pages does the same on its own when the site has no 404.html.
    python3 tools/serve.py [port]        (link the content first: tools/link.py), then open http://localhost:3011"""
import functools, http.server, pathlib, sys

site = pathlib.Path(__file__).resolve().parent.parent

class Site(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        if self.path.split('?')[0].startswith('/watch/'):
            self.path = '/index.html'
        return super().send_head()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 3011
print(f'http://localhost:{port}')
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Site, directory=str(site))).serve_forever()
