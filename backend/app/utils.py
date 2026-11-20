import re
import time
from collections import defaultdict, deque

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_phone(raw: str) -> str:
    """'+998 90 123-45-67' -> '998901234567'. Noto'g'ri bo'lsa ValueError."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 9:
        digits = "998" + digits
    if len(digits) != 12 or not digits.startswith("998"):
        raise ValueError("Telefon raqami noto'g'ri. Namuna: 998901234567")
    return digits


def normalize_email(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip().lower()
    if not value:
        return None
    if len(value) > 100 or not _EMAIL_RE.match(value):
        raise ValueError("Email manzili noto'g'ri")
    return value


class LoginLimiter:
    """Oddiy xotiradagi cheklov (bitta server jarayoni uchun).
    Ko'p serverli productionda Redis kabi umumiy saqlash kerak."""

    def __init__(self):
        self._fails: dict[str, deque] = defaultdict(deque)

    def _prune(self, key: str, window: int):
        q = self._fails[key]
        now = time.monotonic()
        while q and now - q[0] > window:
            q.popleft()

    def blocked(self, key: str, max_attempts: int, window: int) -> bool:
        self._prune(key, window)
        return len(self._fails[key]) >= max_attempts

    def fail(self, key: str):
        self._fails[key].append(time.monotonic())

    def reset(self, key: str):
        self._fails.pop(key, None)

    def clear_all(self):
        self._fails.clear()


login_limiter = LoginLimiter()
