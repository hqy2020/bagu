"""项目中间件：局域网场景 CSRF 放宽 + Admin 自动登录。"""
import ipaddress
import os
from urllib.parse import urlparse

from django.middleware.csrf import CsrfViewMiddleware
from django.contrib.auth.models import User


class LanCsrfViewMiddleware(CsrfViewMiddleware):
    """
    局域网模式下，允许私网来源 IP 通过 Origin 校验。

    说明:
    - 仅放宽 Origin 主机校验，CSRF token 校验逻辑保持 Django 默认行为。
    - 仅允许私网/回环地址来源，且端口需在允许列表内。
    """

    def _origin_verified(self, request):
        if super()._origin_verified(request):
            return True

        if not _lan_origin_relax_enabled():
            return False

        origin = request.META.get('HTTP_ORIGIN')
        if not origin:
            return False

        try:
            parsed = urlparse(origin)
        except Exception:
            return False

        host = parsed.hostname
        if not host:
            return False

        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            return False

        if not (ip.is_private or ip.is_loopback):
            return False

        port = parsed.port
        if port is None:
            port = 443 if parsed.scheme == 'https' else 80

        return str(port) in _lan_allowed_ports()


class AutoLoginAdminMiddleware:
    """访问 /admin/ 时自动登录为 superuser，无需输入账号密码"""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/admin/') and not request.user.is_authenticated:
            admin_user = User.objects.filter(is_superuser=True).first()
            if admin_user:
                from django.contrib.auth import login
                login(request, admin_user)
        return self.get_response(request)


def _lan_origin_relax_enabled():
    flag = os.getenv('LAN_CSRF_ALLOW_PRIVATE_ORIGINS', 'true').strip().lower()
    return flag in {'1', 'true', 'yes', 'on'}


def _lan_allowed_ports():
    raw = os.getenv('LAN_CSRF_ALLOWED_PORTS', '9000,9001,8000,3000')
    parts = [item.strip() for item in raw.split(',')]
    return {item for item in parts if item}
