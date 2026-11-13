import logging
import os
import smtplib
import socket
from email.message import EmailMessage
from typing import Any, Dict, Optional, Tuple

import httpx

try:
    import dns.resolver
except ImportError:
    dns = None

try:
    import email_validator
except ImportError:
    email_validator = None

logger = logging.getLogger("perfAnalyzer.email")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAIL_SERVICE_URL = os.getenv("MAIL_SERVICE_URL", "http://localhost:8001").rstrip("/")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "PerfAnalyzer")


class EmailDeliveryError(Exception):
    """Exception raised when an email cannot be verified or delivered."""
    pass


def get_smtp_config_status() -> Dict[str, Any]:
    """Check whether local SMTP environment variables are configured."""
    return {
        "host": SMTP_HOST or "",
        "port": SMTP_PORT,
        "from_email": SMTP_FROM_EMAIL or "",
        "from_name": SMTP_FROM_NAME or "",
        "is_configured": bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD and SMTP_FROM_EMAIL),
        "mail_service_url": MAIL_SERVICE_URL,
    }


def validate_and_verify_recipient(email_address: str) -> str:
    """
    Validate recipient email syntax, check domain DNS/MX deliverability,
    and verify mailbox existence on destination server (MailService standard).
    Raises EmailDeliveryError if the email address or domain is invalid.
    """
    if not email_address or not email_address.strip():
        raise EmailDeliveryError("Recipient email address cannot be empty.")

    email_clean = email_address.strip()

    # Step 1: Syntax & DNS deliverability check via email-validator (if installed)
    normalized_email = email_clean
    domain = email_clean.split("@")[-1] if "@" in email_clean else ""

    if email_validator:
        try:
            validated = email_validator.validate_email(email_clean, check_deliverability=True)
            normalized_email = validated.normalized
            domain = validated.domain
        except email_validator.EmailNotValidError as e:
            error_msg = str(e)
            if "does not exist" in error_msg:
                raise EmailDeliveryError(f"Domain does not exist: {error_msg}") from e
            raise EmailDeliveryError(f"Invalid email address: {error_msg}") from e

    # Step 2: Query DNS MX records to verify domain accepts email
    primary_mx: Optional[str] = None
    if dns and domain:
        try:
            records = dns.resolver.resolve(domain, "MX", lifetime=5.0)
            sorted_mx = sorted(records, key=lambda x: x.preference)
            if sorted_mx:
                primary_mx = str(sorted_mx[0].exchange).rstrip(".")
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.LifetimeTimeout, Exception) as e:
            raise EmailDeliveryError(
                f"Domain '{domain}' does not accept email: No mail exchanger (MX) records found."
            ) from e

    # Step 3: Direct SMTP mailbox existence check (RCPT TO probe)
    if primary_mx:
        try:
            with smtplib.SMTP(primary_mx, 25, timeout=5) as probe_client:
                probe_client.ehlo("perfAnalyzer.local")
                sender = SMTP_FROM_EMAIL or "verify@perfAnalyzer.local"
                probe_client.mail(sender)
                code, resp_bytes = probe_client.rcpt(normalized_email)
                resp_text = resp_bytes.decode(errors="replace") if isinstance(resp_bytes, bytes) else str(resp_bytes)

                if code in (550, 551, 552, 553, 554, 501, 510, 511, 512, 513):
                    first_line = resp_text.splitlines()[0] if resp_text else "Mailbox does not exist"
                    raise EmailDeliveryError(
                        f"Recipient mailbox does not exist (SMTP {code}): {first_line.strip()}"
                    )
        except EmailDeliveryError:
            raise
        except (socket.timeout, TimeoutError, smtplib.SMTPException, OSError):
            # Port 25 might be blocked by residential ISP or firewall; proceed to relay
            pass

    return normalized_email


def send_email_via_mail_service(
    to: str,
    subject: str,
    body: str,
    html: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Attempt to send an email via the standalone MailService REST API endpoint.
    Returns response dictionary if successful.
    Returns None if MailService is not reachable, so caller can fall back to direct SMTP.
    Raises EmailDeliveryError if MailService returns an explicit client/delivery error.
    """
    if not MAIL_SERVICE_URL:
        return None

    endpoint = f"{MAIL_SERVICE_URL}/api/email/send"
    payload = {
        "to": to,
        "subject": subject,
        "body": body,
        "html": html
    }

    try:
        with httpx.Client(timeout=3.0) as client:
            resp = client.post(endpoint, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                logger.info(f"Email successfully delivered via MailService REST API: {data}")
                return {
                    "sent": True,
                    "method": "mail_service_api",
                    "id": data.get("id"),
                    "message": "Email sent via MailService API"
                }

            # If MailService returned a 400 with a specific error message
            if resp.status_code == 400:
                err_data = resp.json()
                detail = err_data.get("detail") or err_data.get("message") or resp.text
                raise EmailDeliveryError(f"MailService dispatch error: {detail}")

            logger.warning(f"MailService returned unexpected status code {resp.status_code}: {resp.text}")
            return None

    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.NetworkError) as net_err:
        logger.debug(f"MailService microservice not reachable at {endpoint} ({net_err}). Falling back.")
        return None
    except EmailDeliveryError:
        raise
    except Exception as e:
        logger.warning(f"Error querying MailService at {endpoint}: {e}")
        return None


def send_email_via_smtp(
    to: str,
    subject: str,
    body: str,
    html: Optional[str] = None
) -> str:
    """
    Directly dispatch an email via the configured SMTP relay (same engine as MailService).
    Raises EmailDeliveryError with specific failure reasons.
    """
    normalized_to = validate_and_verify_recipient(to)

    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD or not SMTP_FROM_EMAIL:
        raise EmailDeliveryError(
            "SMTP configuration incomplete in .env. Please set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM_EMAIL."
        )

    message = EmailMessage()
    message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
    message["To"] = normalized_to
    message["Subject"] = subject
    message.set_content(body)

    if html:
        message.add_alternative(html, subtype="html")
    else:
        formatted_body = body.replace("\n", "<br>")
        html_fallback = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>{subject}</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; padding: 20px;">
            <h2>{SMTP_FROM_NAME}</h2>
            <div>{formatted_body}</div>
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #e2e8f0;">
            <p style="color: #718096; font-size: 13px;">This is an automated email from {SMTP_FROM_NAME}.</p>
        </body>
        </html>
        """
        message.add_alternative(html_fallback, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=25) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            refused = server.send_message(message)
            if refused:
                reasons = [f"{r_addr}: (SMTP {code}) {msg.decode(errors='replace') if isinstance(msg, bytes) else str(msg)}"
                           for r_addr, (code, msg) in refused.items()]
                raise EmailDeliveryError(f"Recipient rejected by SMTP server: {'; '.join(reasons)}")

    except EmailDeliveryError:
        raise
    except smtplib.SMTPAuthenticationError as e:
        raise EmailDeliveryError(
            f"SMTP Authentication Error: Invalid username or password for '{SMTP_USERNAME}'."
        ) from e
    except smtplib.SMTPRecipientsRefused as e:
        reasons = [f"(SMTP {code}) {msg.decode(errors='replace') if isinstance(msg, bytes) else str(msg)}"
                   for _, (code, msg) in e.recipients.items()]
        raise EmailDeliveryError(f"Recipient rejected by mail server: {'; '.join(reasons)}") from e
    except (socket.timeout, TimeoutError) as e:
        raise EmailDeliveryError(
            f"Network Timeout: Connection to SMTP server '{SMTP_HOST}:{SMTP_PORT}' timed out."
        ) from e
    except (ConnectionRefusedError, socket.gaierror, OSError) as e:
        raise EmailDeliveryError(
            f"Network Dispatch Error: Unable to connect to SMTP server '{SMTP_HOST}:{SMTP_PORT}'. Details: {str(e)}"
        ) from e
    except smtplib.SMTPException as e:
        raise EmailDeliveryError(f"SMTP Dispatch Error: {str(e)}") from e
    except Exception as e:
        raise EmailDeliveryError(f"Email Dispatch Failure: {str(e)}") from e

    return normalized_to


def send_email(
    to: str,
    subject: str,
    body: str,
    html: Optional[str] = None
) -> Dict[str, Any]:
    """
    Unified email sender:
    1. First attempts to deliver via standalone MailService REST API (if available).
    2. If MailService is unreachable, attempts direct delivery via configured SMTP.
    3. If neither MailService nor SMTP is configured, returns fallback dev status.
    """
    # 1. Try MailService microservice API first
    api_result = send_email_via_mail_service(to=to, subject=subject, body=body, html=html)
    if api_result and api_result.get("sent"):
        return api_result

    # 2. Try direct SMTP if configured
    smtp_status = get_smtp_config_status()
    if smtp_status["is_configured"]:
        normalized = send_email_via_smtp(to=to, subject=subject, body=body, html=html)
        logger.info(f"Email successfully delivered directly via SMTP relay to {normalized}")
        return {
            "sent": True,
            "method": "direct_smtp",
            "recipient": normalized,
            "message": "Email sent directly via SMTP"
        }

    # 3. Neither MailService nor SMTP credentials are available
    logger.warning(
        "Neither MailService (at %s) nor SMTP credentials (in .env) are available. "
        "Email dispatch skipped in development mode.",
        MAIL_SERVICE_URL
    )
    return {
        "sent": False,
        "method": "none",
        "message": "MailService and SMTP credentials not configured. Reset link generated for local development."
    }


def build_password_reset_email(
    to_email: str,
    reset_link: str,
    full_name: Optional[str] = None
) -> Tuple[str, str, str]:
    """
    Build email subject, plain text body, and clean minimalist HTML template
    for a PerfAnalyzer password reset request.
    """
    subject = "Reset Your PerfAnalyzer Password"
    name = (full_name or "there").strip()

    # Plain text version
    plain_body = f"""Hi {name},

We received a request to reset your password for your PerfAnalyzer account ({to_email}).

To choose a new password, click the link below:
{reset_link}

This link is valid for 30 minutes. If you did not make this request, you can safely ignore this email.

— The PerfAnalyzer Team
"""

    # Minimalist, clean HTML email template
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; padding: 36px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;" cellspacing="0" cellpadding="0" border="0">
                    <!-- Brand -->
                    <tr>
                        <td style="padding: 24px 28px 16px 28px; border-bottom: 1px solid #f3f4f6;">
                            <div style="font-size: 16px; font-weight: 600; color: #111827; letter-spacing: -0.3px;">
                                PerfAnalyzer
                            </div>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 28px;">
                            <h1 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827; line-height: 1.3;">
                                Reset your password
                            </h1>

                            <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #374151;">
                                Hi {name},
                            </p>

                            <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #4b5563;">
                                We received a request to reset your password for your PerfAnalyzer account (<span style="color: #111827;">{to_email}</span>). Click the button below to set a new password:
                            </p>

                            <!-- Minimal Button -->
                            <div style="margin: 24px 0;">
                                <a href="{reset_link}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 10px 20px; border-radius: 6px;">
                                    Reset password
                                </a>
                            </div>

                            <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
                                This link will expire in 30 minutes. If you didn't request a password reset, you can safely ignore this email.
                            </p>

                            <!-- Subtle link fallback -->
                            <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #f3f4f6;">
                                <p style="margin: 0 0 6px 0; font-size: 12px; color: #9ca3af;">
                                    Button not working? Copy and paste this URL into your browser:
                                </p>
                                <a href="{reset_link}" style="font-size: 12px; color: #4b5563; text-decoration: underline; word-break: break-all; line-height: 1.4;">
                                    {reset_link}
                                </a>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 16px 28px 20px 28px; border-top: 1px solid #f3f4f6; background-color: #fafafa;">
                            <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.4;">
                                &copy; 2026 PerfAnalyzer
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

    return subject, plain_body, html_body

    return subject, plain_body, html_body


def send_password_reset_email(
    to_email: str,
    reset_link: str,
    full_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Build and dispatch a password reset email to the specified recipient.
    """
    subject, plain_body, html_body = build_password_reset_email(
        to_email=to_email,
        reset_link=reset_link,
        full_name=full_name
    )

    result = send_email(
        to=to_email,
        subject=subject,
        body=plain_body,
        html=html_body
    )

    if result.get("sent"):
        result["user_message"] = f"A password reset link has been sent to your email ({to_email}). Please check your inbox."
    else:
        result["user_message"] = "Password reset link generated. Check the terminal or copy below."

    return result
