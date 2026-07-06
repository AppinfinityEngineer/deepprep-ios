"""Classify a source domain into a trust tier (used by scoring/freshness)."""
_PROFILE = {"linkedin.com", "github.com", "twitter.com", "x.com", "medium.com"}
_DIRECTORY = {"crunchbase.com", "zoominfo.com", "rocketreach.co", "apollo.io", "signalhire.com"}
_OFFICIAL = {"gov.uk", "companieshouse.gov.uk"}


def classify(domain: str) -> str:
    d = (domain or "").lower()
    if d in _PROFILE:
        return "profile"
    if d in _DIRECTORY:
        return "directory"
    if any(d.endswith(o) for o in _OFFICIAL):
        return "official"
    return "editorial"
