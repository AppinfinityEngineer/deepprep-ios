"""Classify source domains into trust/source buckets used by scoring."""
from __future__ import annotations

_PROFILE = {
    "linkedin.com",
    "github.com",
    "medium.com",
    "substack.com",
    "twitter.com",
    "x.com",
}
_DIRECTORY = {
    "crunchbase.com",
    "zoominfo.com",
    "rocketreach.co",
    "apollo.io",
    "signalhire.com",
    "theorg.com",
    "wiza.co",
    "finalscout.com",
    "lusha.com",
}
_OFFICIAL = {
    "gov.uk",
    "companieshouse.gov.uk",
    "find-and-update.company-information.service.gov.uk",
}
_NEWS = {
    "bbc.co.uk",
    "bbc.com",
    "theguardian.com",
    "reuters.com",
    "businesswire.com",
    "prnewswire.com",
    "techcrunch.com",
}


def _matches(domain: str, known: set[str]) -> bool:
    d = (domain or "").lower().removeprefix("www.")
    return any(d == k or d.endswith("." + k) or d.endswith(k) for k in known)


def classify(domain: str) -> str:
    d = (domain or "").lower().removeprefix("www.")
    if _matches(d, _PROFILE):
        return "profile"
    if _matches(d, _DIRECTORY):
        return "directory"
    if _matches(d, _OFFICIAL):
        return "official"
    if _matches(d, _NEWS):
        return "news"
    return "editorial"
