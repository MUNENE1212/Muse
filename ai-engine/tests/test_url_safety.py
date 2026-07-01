import pytest

from url_safety import UnsafeURLError, is_safe_url, resolve_url


class _FakeAddrInfo:
    def __init__(self, ip):
        self._ip = ip

    def __getitem__(self, idx):
        if idx == 0:
            return (self._ip, 0)
        raise IndexError


def _patch_resolver(monkeypatch, ips):
    def fake_getaddrinfo(host, port, *args, **kwargs):
        if isinstance(ips, dict):
            ip = ips.get(host)
            if ip is None:
                raise Exception("not found")
        else:
            ip = ips
        return [(2, 1, 6, "", (ip, port or 0))]

    monkeypatch.setattr("url_safety.socket.getaddrinfo", fake_getaddrinfo)


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://127.0.0.53:53/dns",
        "http://10.0.0.1/internal",
        "http://172.16.5.5/secret",
        "http://192.168.1.1/router",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
        "http://[fe80::1]/",
        "http://[fc00::1]/",
        "http://[ff02::1]/",
    ],
)
def test_blocks_private_and_loopback_ranges(url):
    assert is_safe_url(url) is False


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/file",
        "file:///etc/passwd",
        "gopher://example.com/",
        "",
        "javascript:alert(1)",
    ],
)
def test_blocks_disallowed_schemes_and_empty(url):
    assert is_safe_url(url) is False


def test_blocks_when_hostname_resolves_to_private_ip(monkeypatch):
    _patch_resolver(monkeypatch, {"evil.example": "10.0.0.5"})
    assert is_safe_url("https://evil.example/") is False


def test_allows_public_ip_and_returns_resolved(monkeypatch):
    _patch_resolver(monkeypatch, {"good.example": "93.184.216.34"})
    resolved = resolve_url("https://good.example:443/path?x=1")
    assert resolved.host_header == "good.example"
    assert resolved.ip == "93.184.216.34"
    assert resolved.port == 443
    assert resolved.safe_url.startswith("https://93.184.216.34:443/")


def test_resolve_url_raises_on_dns_failure(monkeypatch):
    def fail(*args, **kwargs):
        raise OSError("boom")
    monkeypatch.setattr("url_safety.socket.getaddrinfo", fail)
    with pytest.raises(UnsafeURLError):
        resolve_url("https://nowhere.invalid/")


def test_resolve_url_rejects_missing_hostname():
    with pytest.raises(UnsafeURLError):
        resolve_url("https:///path")
