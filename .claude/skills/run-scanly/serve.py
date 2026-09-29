#!/usr/bin/env python3
"""Static server with SPA fallback, for the exported web build.

`python3 -m http.server` is not enough: Expo Router is a single-page app,
so a nested route like /sign/<doc>/<page> is a client route with no file
behind it and plain http.server answers 404.

Usage: serve.py [root] [port]
"""
import http.server
import os
import socketserver
import sys

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".preview/site")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8100


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        target = self.translate_path(self.path)
        # No file and no extension => a client-side route. Serve the shell.
        if not os.path.exists(target) and "." not in os.path.basename(self.path):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, *args):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
    print(f"serving {ROOT} on http://localhost:{PORT}", flush=True)
    httpd.serve_forever()
