# Локальный сервер для тестов и просмотра: как python -m http.server 8000, только с длинной очередью соединений.
# У http.server очередь — 5: при параллельных тестах Windows отказывает в соединении (ERR_CONNECTION_REFUSED),
# и часть скриптов страницы не загружается. Запуск из корня репозитория: python tests/serve.py
import http.server
import socket


class Server(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6
    request_queue_size = 128

    def server_bind(self):
        # и IPv6, и IPv4: браузер ходит на localhost то через ::1, то через 127.0.0.1
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


print('http://localhost:8000/', flush=True)
Server(('::', 8000), http.server.SimpleHTTPRequestHandler).serve_forever()
