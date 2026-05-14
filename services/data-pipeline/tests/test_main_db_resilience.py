"""Tests for the cron's tolerance to Supabase outages.

These exist because the live cron failed for two days when Supabase paused
the project. The pipeline now downgrades 'tenant not found' / DNS errors to
warnings so the workflow stays green while JSON snapshots keep accumulating.
"""

from __future__ import annotations

from src.main import _is_network_outage, _is_pooler_tenant_missing


def test_pooler_tenant_missing_detected() -> None:
    err = Exception(
        'connection to server at "aws-1-eu-central-1.pooler.supabase.com" '
        '(3.65.151.229), port 6543 failed: FATAL: (ENOTFOUND) tenant/user '
        "postgres.nzuovghfjxnbnraxxkej not found"
    )
    assert _is_pooler_tenant_missing(err) is True


def test_tenant_missing_with_different_casing() -> None:
    err = Exception("FATAL: Tenant Not Found")
    assert _is_pooler_tenant_missing(err) is True


def test_dns_failure_detected_as_network_outage() -> None:
    err = Exception(
        'could not translate host name "db.nzuovghfjxnbnraxxkej.supabase.co" '
        "to address: Name or service not known"
    )
    assert _is_network_outage(err) is True


def test_connection_refused_detected() -> None:
    err = Exception("connection refused")
    assert _is_network_outage(err) is True


def test_normal_auth_failure_is_not_a_network_outage() -> None:
    """We do NOT want to silently swallow a wrong-password error."""
    err = Exception(
        'FATAL: password authentication failed for user "postgres.abc123"'
    )
    assert _is_network_outage(err) is False
    assert _is_pooler_tenant_missing(err) is False
