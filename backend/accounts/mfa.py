import base64
import binascii
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote


def generate_totp_secret():
    return base64.b32encode(secrets.token_bytes(20)).decode('ascii').rstrip('=')


def totp_code(secret, *, at_time=None):
    padding = '=' * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(secret + padding, casefold=True)
    counter = int(time.time() if at_time is None else at_time) // 30
    digest = hmac.new(key, struct.pack('>Q', counter), hashlib.sha1).digest()
    index = digest[-1] & 0x0F
    value = (struct.unpack('>I', digest[index:index + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f'{value:06d}'


def matching_totp_step(secret, code, *, valid_window=1, at_time=None):
    normalized = str(code or '').strip()
    if len(normalized) != 6 or not normalized.isdigit() or not secret:
        return None
    try:
        timestamp = time.time() if at_time is None else at_time
        current_step = int(timestamp) // 30
        candidates = [
            (current_step + offset, totp_code(secret, at_time=(current_step + offset) * 30))
            for offset in range(-valid_window, valid_window + 1)
        ]
    except (binascii.Error, ValueError, TypeError):
        return None
    for step, candidate in candidates:
        if hmac.compare_digest(candidate, normalized):
            return step
    return None


def verify_totp(secret, code, *, valid_window=1, at_time=None):
    return matching_totp_step(
        secret, code, valid_window=valid_window, at_time=at_time
    ) is not None


def provisioning_uri(user, secret):
    account = quote(user.email or user.username, safe='')
    issuer = quote('Eventloo', safe='')
    return f'otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&digits=6&period=30'
