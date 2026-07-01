import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse


class UnsafeURLError(ValueError):
    pass


@dataclass(frozen=True)
class ResolvedURL:
    safe_url: str
    host_header: str
    ip: str
    port: int | None
    scheme: str


def _is_forbidden_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip.is_loopback:
        return True
    if ip.is_private:
        return True
    if ip.is_link_local:
        return True
    if ip.is_multicast:
        return True
    if ip.is_reserved:
        return True
    if ip.is_unspecified:
        return True
    return False


def _resolve_hostname(host: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError as exc:
        raise UnsafeURLError(f"DNS resolution failed for {host!r}: {exc}") from exc
    return list({info[4][0] for info in infos})


def _format_netloc(ip: str, port: int | None) -> str:
    if ":" in ip and not ip.startswith("["):
        host_for_url = f"[{ip}]"
    else:
        host_for_url = ip
    if port is not None:
        return f"{host_for_url}:{port}"
    return host_for_url


def resolve_url(url: str) -> ResolvedURL:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise UnsafeURLError(
            f"URL scheme {parsed.scheme!r} is not allowed; use http or https"
        )

    host = parsed.hostname
    if not host:
        raise UnsafeURLError("URL is missing a hostname")

    addresses = _resolve_hostname(host)
    if not addresses:
        raise UnsafeURLError(f"DNS resolution returned no addresses for {host!r}")

    chosen_ip: str | None = None
    for raw_ip in addresses:
        try:
            ip = ipaddress.ip_address(raw_ip)
        except ValueError:
            continue
        if _is_forbidden_ip(ip):
            raise UnsafeURLError(
                f"URL resolves to forbidden address {ip} "
                "(loopback/private/link-local/multicast/reserved)"
            )
        chosen_ip = raw_ip

    if chosen_ip is None:
        raise UnsafeURLError("None of the resolved addresses are usable")

    netloc = _format_netloc(chosen_ip, parsed.port)
    safe_url = urlunparse(parsed._replace(netloc=netloc))
    return ResolvedURL(
        safe_url=safe_url,
        host_header=host,
        ip=chosen_ip,
        port=parsed.port,
        scheme=parsed.scheme,
    )


def is_safe_url(url: str) -> bool:
    try:
        resolve_url(url)
    except UnsafeURLError:
        return False
    return True
