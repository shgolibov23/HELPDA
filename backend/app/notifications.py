import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.models import AppNotification, PushToken

log = logging.getLogger("helpda.notifications")


def create_notification(
    db: Session,
    user_id: int,
    kind: str,
    title: str,
    message: str,
    order_id: int | None = None,
) -> None:
    item = AppNotification(
        user_id=user_id,
        kind=kind,
        title=title,
        message=message,
        order_id=order_id,
    )
    db.add(item)
    db.flush()
    tokens = db.query(PushToken).filter(PushToken.user_id == user_id).limit(100).all()
    if not tokens:
        return
    messages = [
        {
            "to": token.token,
            "title": title,
            "body": "Yangi yangilik bor. Batafsil ma’lumot ilovada.",
            "data": {"notification_id": item.id, "order_id": order_id, "kind": kind},
            "sound": "default",
        }
        for token in tokens
    ]
    try:
        response = httpx.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=5,
        )
        response.raise_for_status()
        tickets = response.json().get("data")
        if not isinstance(tickets, list):
            raise ValueError("Expo push javobi noto‘g‘ri formatda.")
        for token, ticket in zip(tokens, tickets):
            if not isinstance(ticket, dict) or ticket.get("status") != "error":
                continue
            error = ticket.get("details", {}).get("error")
            if error == "DeviceNotRegistered":
                db.delete(token)
            log.warning("Expo push ticket rejected (%s): %s", error, ticket.get("message", "no details"))
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Expo push yuborilmadi user=%s: %s", user_id, exc)


def mark_read(notification: AppNotification) -> None:
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
