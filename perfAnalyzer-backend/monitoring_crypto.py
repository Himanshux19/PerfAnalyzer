import os
import base64
import hashlib
from cryptography.fernet import Fernet

def _get_cipher() -> Fernet:
    """
    Obtain a Fernet cipher instance based on UPTRACE_DSN or a deterministic secret fallback derived from JWT_SECRET.
    """
    raw_key = os.getenv("UPTRACE_DSN", "").strip()
    if raw_key:
        try:
            return Fernet(raw_key.encode("utf-8"))
        except Exception:
            pass
    
    # Fallback to deterministic key derived from JWT_SECRET or app secret
    jwt_secret = os.getenv("JWT_SECRET", "perfanalyzer-monitoring-secure-default-key-2026")
    key_material = hashlib.sha256(jwt_secret.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(key_material)
    return Fernet(fernet_key)

def encrypt_dsn(plaintext_dsn: str) -> str:
    """
    Encrypts a plaintext Uptrace DSN string.
    """
    if not plaintext_dsn:
        return ""
    cipher = _get_cipher()
    return cipher.encrypt(plaintext_dsn.strip().encode("utf-8")).decode("utf-8")

def decrypt_dsn(encrypted_dsn: str) -> str:
    """
    Decrypts an encrypted Uptrace DSN string.
    """
    if not encrypted_dsn:
        return ""
    try:
        cipher = _get_cipher()
        return cipher.decrypt(encrypted_dsn.strip().encode("utf-8")).decode("utf-8")
    except Exception:
        return ""
