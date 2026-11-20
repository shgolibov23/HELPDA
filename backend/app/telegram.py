"""Telegram bot: yangi arizalarni adminlarga yuboradi, tugma bilan tasdiqlash/rad etish,
natijani ariza egasiga yetkazadi. Token .env da (TELEGRAM_BOT_TOKEN), kodda emas.

Bot "long polling" bilan ishlaydi: ochiq domen yoki HTTPS shart emas (Mac'da sinash uchun qulay).
"""
import logging
import re
import threading
import time
from html import escape as _html_escape

import httpx

from app import applications
from app.applications import ApplicationError
from app.config import settings
from app.database import SessionLocal
from app.models import ApplicationNotification, BusinessApplication, User

log = logging.getLogger("helpda.telegram")

REJECT_PROMPT = "Rad etish sababini yozing"
TYPE_LABELS = {"mchj": "MChJ", "ytt": "YTT", "self_employed": "O'zini o'zi band qilgan"}


def esc(value) -> str:
    """Telegram HTML uchun faqat & < > almashtiriladi."""
    return _html_escape(str(value), quote=False)


def enabled() -> bool:
    return bool(settings.TELEGRAM_BOT_TOKEN)


# ---------- Past darajadagi chaqiruvlar ----------

def call(method: str, **params):
    """Telegram Bot API chaqiruvi. Xatoda None qaytaradi (asosiy oqimni buzmaydi).
    Xato matniga URL (ya'ni token) qo'shilmaydi."""
    if not enabled():
        return None
    try:
        r = httpx.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}",
            json=params,
            timeout=35,
        )
        data = r.json()
        if not data.get("ok"):
            log.warning("Telegram %s rad etildi: %s", method, data.get("description"))
            return None
        return data.get("result")
    except Exception as exc:  # noqa: BLE001
        log.warning("Telegram %s xatosi: %s", method, type(exc).__name__)
        return None


def send_message(chat_id: int, text: str, reply_markup: dict | None = None) -> int | None:
    params: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if reply_markup:
        params["reply_markup"] = reply_markup
    res = call("sendMessage", **params)
    return res.get("message_id") if isinstance(res, dict) else None


def edit_message(chat_id: int, message_id: int, text: str) -> None:
    call(
        "editMessageText",
        chat_id=chat_id,
        message_id=message_id,
        text=text,
        parse_mode="HTML",
        reply_markup={"inline_keyboard": []},
    )


def answer_callback(callback_id: str, text: str | None = None, alert: bool = False) -> None:
    params: dict = {"callback_query_id": callback_id, "show_alert": alert}
    if text:
        params["text"] = text
    call("answerCallbackQuery", **params)


# ---------- Xabar matnlari ----------

def application_text(a: BusinessApplication, u: User, status_line: str | None = None) -> str:
    recommendation_labels = {
        "matches": "Tanlangan yo'nalishlarga mos",
        "mismatch": "Tanlangan yo'nalishlarga mos emas",
        "needs_review": "Qo'lda tekshirish kerak",
    }
    lines = [
        f"🆕 <b>Biznes arizasi #{a.id}</b>",
        "",
        f"🏢 <b>{esc(a.business_name)}</b>",
        f"📄 Shakl: {esc(TYPE_LABELS.get(a.business_type, a.business_type))}",
        f"🔢 STIR: <code>{esc(a.registration_number)}</code>",
        f"📞 Biznes tel.: +{esc(a.business_phone)}",
        f"📍 {esc(a.city)}, {esc(a.address)}",
        f"🧩 Yo'nalishlar: {esc(', '.join(category.name for category in a.categories) or 'Ko‘rsatilmagan')}",
        f"📎 Maxfiy PDF: {'bor' if a.document_path else 'yo‘q'}",
        "",
        f"👤 Ariza egasi: {esc(u.full_name)} (+{esc(u.phone)})",
        f"💼 Lavozimi: {esc(a.applicant_position)}",
    ]
    if a.description:
        lines += ["", f"📝 <b>Biznes haqida:</b>\n{esc(a.description[:700])}"]
    lines += ["", f"🤖 <b>AI tavsiyasi:</b> {esc(recommendation_labels.get(a.ai_recommendation, 'Tahlil mavjud emas'))}"]
    if a.ai_status == "completed" and a.ai_confidence is not None:
        lines[-1] += f" ({a.ai_confidence:.0%})"
    if a.ai_summary:
        lines += [esc(a.ai_summary[:1200])]
    lines += ["", "⚠️ <i>AI faqat tavsiya beradi. Davlat reyestri tekshiruvi o'tkazilmagan; yakuniy qaror admin tomonidan qilinadi.</i>"]
    if status_line:
        lines += ["", status_line]
    return "\n".join(lines)


def _keyboard(application_id: int) -> dict:
    return {
        "inline_keyboard": [
            [
                {"text": "✅ Tasdiqlash", "callback_data": f"ap:a:{application_id}"},
                {"text": "❌ Rad etish", "callback_data": f"ap:r:{application_id}"},
            ]
        ]
    }


# ---------- Bildirishnomalar (backenddan chaqiriladi) ----------

def notify_new_application(application_id: int) -> None:
    """Yangi ariza haqida barcha adminlarga xabar. BackgroundTasks orqali chaqiriladi."""
    if not enabled():
        return
    if not settings.TELEGRAM_ADMIN_IDS:
        log.warning("TELEGRAM_ADMIN_IDS bo'sh: ariza adminlarga yuborilmadi.")
        return
    db = SessionLocal()
    try:
        a = db.get(BusinessApplication, application_id)
        u = db.get(User, a.applicant_id) if a else None
        if not a or not u:
            return
        text = application_text(a, u)
        for admin_id in settings.TELEGRAM_ADMIN_IDS:
            mid = send_message(admin_id, text, _keyboard(a.id))
            if mid:
                db.add(ApplicationNotification(application_id=a.id, chat_id=admin_id, message_id=mid))
        db.commit()
    finally:
        db.close()


def notify_decision(application_id: int, decided_by: str) -> None:
    """Qaror qabul qilingach: admin xabarlarini yangilaydi va ariza egasiga yozadi."""
    if not enabled():
        return
    db = SessionLocal()
    try:
        a = db.get(BusinessApplication, application_id)
        u = db.get(User, a.applicant_id) if a else None
        if not a or not u:
            return
        if a.status == "approved":
            status_line = f"✅ <b>Tasdiqlandi</b> — {esc(decided_by)}"
        else:
            status_line = f"❌ <b>Rad etildi</b> — {esc(decided_by)}\nSabab: {esc(a.rejection_reason or '')}"
        text = application_text(a, u, status_line)
        for n in db.query(ApplicationNotification).filter(ApplicationNotification.application_id == a.id).all():
            edit_message(n.chat_id, n.message_id, text)

        if u.telegram_chat_id:
            if a.status == "approved":
                msg = (
                    f"✅ <b>Biznesingiz tasdiqlandi!</b>\n“{esc(a.business_name)}” endi xizmat e'lon qila oladi. "
                    "HELPDA ilovasini qayta oching."
                )
            else:
                msg = (
                    f"❌ <b>Arizangiz rad etildi.</b>\n“{esc(a.business_name)}”\n\n"
                    f"Sabab: {esc(a.rejection_reason or '')}\n\n"
                    "Ma'lumotlarni to'g'rilab, ilovadan qayta topshirishingiz mumkin."
                )
            send_message(u.telegram_chat_id, msg)
    finally:
        db.close()


# ---------- Botga kelgan xabarlar ----------

def _is_admin(user_id: int | None) -> bool:
    return user_id is not None and user_id in settings.TELEGRAM_ADMIN_IDS


def _link_account(chat_id: int, token: str) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_link_token == token).first()
        if not user:
            send_message(chat_id, "Havola eskirgan yoki noto'g'ri. Ilovadan “Telegram'ni ulash” tugmasini qayta bosing.")
            return
        # bitta Telegram hisobi faqat bitta foydalanuvchiga bog'lanadi
        db.query(User).filter(User.telegram_chat_id == chat_id, User.id != user.id).update(
            {User.telegram_chat_id: None}
        )
        user.telegram_chat_id = chat_id
        user.telegram_link_token = None
        db.commit()
        send_message(chat_id, f"✅ Telegram ulandi, {esc(user.full_name)}! Ariza natijasi shu yerga keladi.")
    finally:
        db.close()


def _on_message(msg: dict) -> None:
    chat_id = (msg.get("chat") or {}).get("id")
    from_user = msg.get("from") or {}
    from_id = from_user.get("id")
    text = (msg.get("text") or "").strip()
    if chat_id is None:
        return

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        if len(parts) == 2:
            _link_account(chat_id, parts[1].strip())
        else:
            send_message(chat_id, "👋 HELPDA botiga xush kelibsiz.\nHisobni ulash uchun ilovadagi “Telegram'ni ulash” tugmasini bosing.")
        return

    if text == "/id":
        send_message(chat_id, f"Sizning Telegram ID: <code>{from_id}</code>")
        return

    reply = msg.get("reply_to_message")
    if reply and _is_admin(from_id) and REJECT_PROMPT in (reply.get("text") or ""):
        m = re.search(r"#(\d+)", reply.get("text") or "")
        if not m:
            return
        application_id = int(m.group(1))
        name = from_user.get("first_name") or "admin"
        db = SessionLocal()
        try:
            applications.reject(db, application_id, text)
        except ApplicationError as e:
            send_message(chat_id, f"⚠️ {esc(e.message)}")
            return
        finally:
            db.close()
        send_message(chat_id, f"Ariza #{application_id} rad etildi ✅")
        notify_decision(application_id, name)


def _on_callback(cb: dict) -> None:
    cb_id = cb.get("id", "")
    from_user = cb.get("from") or {}
    uid = from_user.get("id")
    chat_id = ((cb.get("message") or {}).get("chat") or {}).get("id")
    if not _is_admin(uid):
        answer_callback(cb_id, "Sizda ruxsat yo'q", alert=True)
        return
    m = re.fullmatch(r"ap:([ar]):(\d+)", cb.get("data") or "")
    if not m:
        answer_callback(cb_id)
        return
    action, application_id = m.group(1), int(m.group(2))
    name = from_user.get("first_name") or "admin"

    if action == "a":
        db = SessionLocal()
        try:
            applications.approve(db, application_id)
        except ApplicationError as e:
            answer_callback(cb_id, e.message, alert=True)
            return
        finally:
            db.close()
        answer_callback(cb_id, "Tasdiqlandi ✅")
        notify_decision(application_id, name)
    else:
        answer_callback(cb_id)
        if chat_id is not None:
            send_message(
                chat_id,
                f"❌ Ariza #{application_id}: <b>{REJECT_PROMPT}</b> (kamida 5 belgi).\n"
                "Shu xabarga <b>javob (reply)</b> tarzida yuboring.",
                {"force_reply": True, "selective": True},
            )


def handle_update(update: dict) -> None:
    if "callback_query" in update:
        _on_callback(update["callback_query"])
    elif "message" in update:
        _on_message(update["message"])


# ---------- Polling ----------

_stop = threading.Event()
_thread: threading.Thread | None = None


def _poll_loop() -> None:
    call("deleteWebhook")
    offset = None
    while not _stop.is_set():
        params: dict = {"timeout": 25, "allowed_updates": ["message", "callback_query"]}
        if offset is not None:
            params["offset"] = offset
        updates = call("getUpdates", **params)
        if updates is None:
            _stop.wait(3)
            continue
        for u in updates:
            offset = u["update_id"] + 1
            try:
                handle_update(u)
            except Exception:  # noqa: BLE001
                log.exception("Telegram update'ni qayta ishlashda xato")


def start_polling() -> None:
    global _thread
    if not enabled() or not settings.TELEGRAM_POLLING or _thread is not None:
        return
    if not settings.TELEGRAM_ADMIN_IDS:
        log.warning("TELEGRAM_ADMIN_IDS bo'sh: tugmalarni hech kim bosa olmaydi.")
    _stop.clear()
    _thread = threading.Thread(target=_poll_loop, name="telegram-poller", daemon=True)
    _thread.start()
    log.info("Telegram bot ishga tushdi.")


def stop_polling() -> None:
    _stop.set()
