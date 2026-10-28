"""
wsgi.py - WSGI entrypoint for PythonAnywhere, cPanel, Gunicorn, uWSGI.
Zero dependency, standard library only.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import parse_qs, unquote

# Pastikan path repo ada di sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import server  # import server logic

# Inisialisasi database jika belum ada
server.init_db()


class WsgiContext:
    def __init__(self, environ):
        self.environ = environ
        self.command = environ.get("REQUEST_METHOD", "GET").upper()
        self.path = environ.get("PATH_INFO", "/")
        self.query_string = environ.get("QUERY_STRING", "")
        self.query = {k: v[-1] for k, v in parse_qs(self.query_string).items()}
        self.ip = environ.get("HTTP_X_FORWARDED_FOR", environ.get("REMOTE_ADDR", "127.0.0.1")).split(",")[0].strip()
        self.client_address = (self.ip, 0)
        self.is_https = environ.get("wsgi.url_scheme") == "https" or environ.get("HTTP_X_FORWARDED_PROTO") == "https"

        # Headers mapping
        self.headers = {}
        if environ.get("CONTENT_TYPE"):
            self.headers["Content-Type"] = environ["CONTENT_TYPE"]
        if environ.get("CONTENT_LENGTH"):
            self.headers["Content-Length"] = environ["CONTENT_LENGTH"]
        for k, v in environ.items():
            if k.startswith("HTTP_"):
                header_name = "-".join(w.capitalize() for w in k[5:].split("_"))
                self.headers[header_name] = v

        self.status = 200
        self.response_headers = []
        self.response_body = b""

    def cookie_flags(self) -> str:
        secure = "; Secure" if self.is_https else ""
        return f"; Path=/; HttpOnly; SameSite=Strict{secure}"

    def send_bytes(self, status: int, body: bytes, ctype: str, headers: dict | None = None, cookies: list | None = None):
        self.status = status
        self.response_body = body
        hdrs = [
            ("Content-Type", ctype),
            ("Content-Length", str(len(body))),
            ("X-Content-Type-Options", "nosniff"),
            ("X-Frame-Options", "DENY"),
            ("Referrer-Policy", "same-origin"),
            ("Permissions-Policy", "camera=(self), microphone=(), geolocation=()"),
            ("Content-Security-Policy", server.CSP),
        ]
        for k, v in (headers or {}).items():
            hdrs.append((k, v))
        for c in (cookies or []):
            hdrs.append(("Set-Cookie", c))
        self.response_headers = hdrs

    def send_json(self, status: int, obj, cookies: list | None = None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_bytes(status, body, "application/json; charset=utf-8", {"Cache-Control": "no-store"}, cookies)

    def current_admin(self, conn):
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        try:
            c = SimpleCookie(raw)
            sid = c["sid"].value
        except Exception:
            return None
        import hashlib, time
        th = hashlib.sha256(sid.encode()).hexdigest()
        return conn.execute(
            "SELECT a.* FROM sessions s JOIN admins a ON a.id = s.admin_id "
            "WHERE s.token_hash = ? AND s.expires_at > ?",
            (th, int(time.time())),
        ).fetchone()

    def check_csrf(self):
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if int(self.headers.get("Content-Length") or 0) > 0 and ctype != "application/json":
            raise server.ApiError(415, "Content-Type harus application/json.")
        origin = self.headers.get("Origin")
        if origin:
            from urllib.parse import urlparse
            host = self.headers.get("Host", "")
            if urlparse(origin).netloc != host:
                raise server.ApiError(403, "Permintaan lintas-origin ditolak.")

    def read_body(self) -> dict:
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n > server.MAX_BODY:
            raise server.ApiError(413, "Permintaan terlalu besar.")
        stream = self.environ.get("wsgi.input")
        raw = stream.read(n) if (stream and n) else b""
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise server.ApiError(400, "JSON tidak valid.")
        if not isinstance(data, dict):
            raise server.ApiError(400, "Body harus berupa objek JSON.")
        return data


def application(environ, start_response):
    ctx = WsgiContext(environ)
    path = ctx.path

    status_codes = {
        200: "200 OK", 201: "201 Created", 400: "400 Bad Request", 401: "401 Unauthorized",
        403: "403 Forbidden", 404: "404 Not Found", 405: "405 Method Not Allowed",
        409: "409 Conflict", 413: "413 Payload Too Large", 415: "415 Unsupported Media Type",
        422: "422 Unprocessable Content", 429: "429 Too Many Requests", 500: "500 Internal Server Error"
    }

    try:
        if path.startswith("/api/"):
            # Route match
            for method, pattern, auth, fn in server.ROUTES:
                m = pattern.match(path)
                if m and method == ctx.command:
                    break
            else:
                if any(p.match(path) for _, p, _, _ in server.ROUTES):
                    raise server.ApiError(405, "Metode tidak diizinkan.")
                raise server.ApiError(404, "Endpoint tidak ditemukan.")

            body = {}
            if ctx.command in ("POST", "PUT", "DELETE"):
                ctx.check_csrf()
                body = ctx.read_body()

            conn = server.db()
            try:
                admin = None
                if auth:
                    admin = ctx.current_admin(conn)
                    if not admin:
                        raise server.ApiError(401, "Sesi berakhir. Silakan masuk kembali.")
                    if auth == "admin" and admin["role"] != "admin":
                        raise server.ApiError(403, "Akses ditolak untuk peran Anda.")
                fn(ctx, conn, admin, m, body)
            finally:
                conn.close()

        elif ctx.command in ("GET", "HEAD"):
            # Static files
            rel = server.PAGES.get(path.rstrip("/") or "/", None)
            if rel is None:
                rel = unquote(path).lstrip("/")
            target = (server.STATIC / rel).resolve()
            if server.STATIC.resolve() not in target.parents or not target.is_file():
                raise server.ApiError(404, "Halaman tidak ditemukan.")
            ctype = server.MIME.get(target.suffix.lower(), "application/octet-stream")
            cache = "public, max-age=604800" if target.suffix in (".woff2", ".png", ".jpg", ".svg", ".ico") or "vendor" in target.parts else "no-cache"
            ctx.send_bytes(200, target.read_bytes(), ctype, {"Cache-Control": cache})
        else:
            raise server.ApiError(405, "Metode tidak diizinkan.")

    except server.ApiError as e:
        resp = {"error": e.message, "fields": e.fields, **e.extra}
        ctx.send_json(e.status, resp)
    except Exception as e:
        sys.stderr.write(f"[WSGI ERROR] {type(e).__name__}: {e}\n")
        ctx.send_json(500, {"error": "Terjadi kesalahan pada server."})

    status_str = status_codes.get(ctx.status, f"{ctx.status} Unknown")
    start_response(status_str, ctx.response_headers)
    if ctx.command == "HEAD":
        return [b""]
    return [ctx.response_body]


if __name__ == "__main__":
    # Test lokal WSGI jika dijalankan langsung
    from wsgiref.simple_server import make_server
    port = int(os.environ.get("PORT", 8080))
    print(f"WSGI local test running at http://127.0.0.1:{port}/")
    with make_server("127.0.0.1", port, application) as httpd:
        httpd.serve_forever()
