# Локальный сервер для тестов и просмотра: как python -m http.server 8000, только с длинной очередью соединений.
# У http.server очередь — 5: при параллельных тестах Windows отказывает в соединении (ERR_CONNECTION_REFUSED),
# и часть скриптов страницы не загружается. Запуск из корня репозитория: python tests/serve.py
import http.server
import os
import socket


class Server(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6
    request_queue_size = 128

    def server_bind(self):
        # и IPv6, и IPv4: браузер ходит на localhost то через ::1, то через 127.0.0.1
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


# порт — STUDIO_E2E_PORT (по умолчанию 8000): если 8000 держит сервер из другой папки, Playwright гоняется на своём порту
PORT = int(os.environ.get('STUDIO_E2E_PORT', '8000'))
print(f'http://localhost:{PORT}/', flush=True)
Server(('::', PORT), http.server.SimpleHTTPRequestHandler).serve_forever()
