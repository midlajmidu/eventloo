from django.apps import AppConfig
from django.db.backends.signals import connection_created


def configure_sqlite_performance(sender, connection, **kwargs):
    """Enforce WAL mode, 64MB RAM cache, and low-latency sync on SQLite connections."""
    if connection.vendor == 'sqlite':
        try:
            cursor = connection.cursor()
            cursor.execute('PRAGMA journal_mode=WAL;')
            cursor.execute('PRAGMA synchronous=NORMAL;')
            cursor.execute('PRAGMA cache_size=-64000;')
            cursor.execute('PRAGMA busy_timeout=5000;')
            cursor.execute('PRAGMA temp_store=MEMORY;')
        except Exception:
            pass


class EventsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'events'

    def ready(self):
        connection_created.connect(configure_sqlite_performance)

