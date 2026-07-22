import ssl

import app.main as main
import app.persistence as persistence


def test_secure_database_url_enables_certificate_verification(monkeypatch):
    monkeypatch.setenv("TIDB_SSL", "true")
    monkeypatch.delenv("TIDB_SSL_CA", raising=False)
    secured = main.secure_database_url("mysql+pymysql://user:pass@example.com:4000/vio")
    assert "ssl_ca=/etc/ssl/certs/ca-certificates.crt" in secured
    assert "ssl_verify_cert=true" in secured
    assert "ssl_verify_identity=true" in secured


def test_secure_database_url_preserves_explicit_tls_configuration(monkeypatch):
    monkeypatch.setenv("TIDB_SSL", "true")
    configured = "mysql+pymysql://user:pass@example.com/vio?ssl_ca=/custom/ca.pem"
    assert main.secure_database_url(configured) == configured


def test_pymysql_connection_uses_a_real_tls_context(monkeypatch):
    captured = {}

    def fake_connect(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(persistence.pymysql, "connect", fake_connect)
    monkeypatch.setenv("AGNO_DATABASE_URL", "mysql+pymysql://user:pass@example.com:4000/vio")
    monkeypatch.setenv("TIDB_SSL", "true")
    persistence._connection()
    assert isinstance(captured["ssl"], ssl.SSLContext)
    assert captured["ssl"].verify_mode == ssl.CERT_REQUIRED
    assert captured["ssl"].check_hostname is True


def test_event_logging_failure_does_not_break_streaming(monkeypatch):
    def fail(*_args, **_kwargs):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(main, "record_event", fail)
    main.record_event_safely("run-id", "error", {"code": "PROVIDER_ERROR"})
