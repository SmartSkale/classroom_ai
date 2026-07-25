"""SMTP transactional email helpers for group invites and assignments."""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr
from html import escape

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html: str) -> None:
    """Send one HTML email via SMTP. No-ops when SMTP is not configured."""
    settings = get_settings()
    if not settings.smtp_host:
        logger.warning("SMTP_HOST not configured; skipping email to %s", to)
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.email_from
    message["To"] = to
    message.attach(MIMEText(html, "html", "utf-8"))

    _, from_addr = parseaddr(settings.email_from)
    envelope_from = from_addr or settings.smtp_username or settings.email_from

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.sendmail(envelope_from, [to], message.as_string())
        logger.info("Sent email to %s: %s", to, subject)
    except Exception:
        logger.exception("Failed to send email to %s (subject=%s)", to, subject)


def notify_added_to_group(
    to: str,
    *,
    group_name: str,
    teacher_name: str,
) -> None:
    """Notify a student they were added to a class group."""
    settings = get_settings()
    login_url = f"{settings.frontend_url.rstrip('/')}/login"
    safe_group = escape(group_name)
    safe_teacher = escape(teacher_name)
    subject = f"You've been added to {group_name}"
    html = f"""
    <p>Hi,</p>
    <p><strong>{safe_teacher}</strong> added you to the group <strong>{safe_group}</strong>
    on Classroom AI.</p>
    <p>Sign in or register with this email address to view your class and any assigned work:</p>
    <p><a href="{escape(login_url)}">{escape(login_url)}</a></p>
    <p>— Classroom AI</p>
    """
    send_email(to, subject, html)


def notify_password_reset(to: str, *, token: str) -> None:
    """Email a one-time password reset link."""
    settings = get_settings()
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    subject = "Reset your Classroom AI password"
    html = f"""
    <p>Hi,</p>
    <p>We received a request to reset your Classroom AI password.</p>
    <p><a href="{escape(reset_url)}">Reset your password</a></p>
    <p>This link expires in {settings.password_reset_expire_minutes} minutes.
    If you did not request this, you can ignore this email.</p>
    <p>— Classroom AI</p>
    """
    if not settings.smtp_host:
        logger.warning(
            "SMTP_HOST not configured; password reset link for %s: %s",
            to,
            reset_url,
        )
        return
    send_email(to, subject, html)


def notify_assignment(
    to: str,
    *,
    group_name: str,
    assignment_title: str,
    teacher_name: str,
) -> None:
    """Notify a student that a new assessment/lesson was assigned."""
    settings = get_settings()
    dashboard_url = f"{settings.frontend_url.rstrip('/')}/dashboard"
    safe_group = escape(group_name)
    safe_title = escape(assignment_title)
    safe_teacher = escape(teacher_name)
    subject = f"New assessment assigned: {assignment_title}"
    html = f"""
    <p>Hi,</p>
    <p><strong>{safe_teacher}</strong> assigned a new assessment in
    <strong>{safe_group}</strong>:</p>
    <p><strong>{safe_title}</strong></p>
    <p>Open your dashboard to get started:</p>
    <p><a href="{escape(dashboard_url)}">{escape(dashboard_url)}</a></p>
    <p>— Classroom AI</p>
    """
    send_email(to, subject, html)
