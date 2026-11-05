import ssl
import certifi
from django.core.mail.backends.smtp import EmailBackend as DjangoEmailBackend

class SSLContextEmailBackend(DjangoEmailBackend):
    """
    Hardened SMTP email backend that reliably configures SSL context
    using certifi root CA certificates across macOS, Linux, and Docker environments.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.use_tls or self.use_ssl:
            try:
                self.ssl_context = ssl.create_default_context(cafile=certifi.where())
            except Exception:
                self.ssl_context = ssl.create_default_context()
