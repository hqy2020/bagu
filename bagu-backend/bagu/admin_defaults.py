"""Default Django admin account helpers."""

from django.contrib.auth import get_user_model


DEFAULT_ADMIN_USERNAME = 'admin'
DEFAULT_ADMIN_PASSWORD = 'admin'
DEFAULT_ADMIN_EMAIL = 'admin@local.com'


def ensure_default_admin():
    """Ensure the local admin/admin account can access Django admin."""
    User = get_user_model()
    admin_user, created = User.objects.get_or_create(
        username=DEFAULT_ADMIN_USERNAME,
        defaults={'email': DEFAULT_ADMIN_EMAIL},
    )

    changed = created
    if admin_user.email != DEFAULT_ADMIN_EMAIL:
        admin_user.email = DEFAULT_ADMIN_EMAIL
        changed = True
    if not admin_user.is_staff:
        admin_user.is_staff = True
        changed = True
    if not admin_user.is_superuser:
        admin_user.is_superuser = True
        changed = True
    if not admin_user.is_active:
        admin_user.is_active = True
        changed = True
    if not admin_user.check_password(DEFAULT_ADMIN_PASSWORD):
        admin_user.set_password(DEFAULT_ADMIN_PASSWORD)
        changed = True

    if changed:
        admin_user.save()

    return admin_user, created, changed
