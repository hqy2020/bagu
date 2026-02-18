"""Django Admin 免登录中间件 - 局域网场景自动以 admin 身份访问"""
from django.contrib.auth.models import User


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
