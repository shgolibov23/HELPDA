import pytest

from app import telegram
from app.config import settings
from app.database import SessionLocal
from app.models import ApplicationNotification, User

ADMIN_TG = 111
USER_TG = 555


class FakeTelegram:
    def __init__(self):
        self.calls = []
        self._mid = 100

    def __call__(self, method, **params):
        self.calls.append((method, params))
        if method == "sendMessage":
            self._mid += 1
            return {"message_id": self._mid}
        return {}

    def sent_to(self, chat_id):
        return [p["text"] for m, p in self.calls if m == "sendMessage" and p["chat_id"] == chat_id]

    def methods(self, name):
        return [p for m, p in self.calls if m == name]


@pytest.fixture()
def tg(monkeypatch):
    fake = FakeTelegram()
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TELEGRAM_BOT_USERNAME", "helpda_test_bot")
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_IDS", [ADMIN_TG])
    monkeypatch.setattr(telegram, "call", fake)
    return fake


def _link_user(api, client, token, tg_chat=USER_TG):
    r = client.post("/me/telegram/link", headers=api.h(token))
    assert r.status_code == 200, r.text
    start_token = r.json()["url"].split("start=")[1]
    telegram.handle_update({"message": {"chat": {"id": tg_chat}, "from": {"id": tg_chat}, "text": f"/start {start_token}"}})


def _cb(data, uid=ADMIN_TG):
    return {"callback_query": {"id": "cb1", "from": {"id": uid, "first_name": "Admin"}, "message": {"chat": {"id": uid}}, "data": data}}


def test_link_disabled_without_bot(api, client):
    token, _ = api.register("998901234567")
    assert client.get("/me/telegram", headers=api.h(token)).json() == {"configured": False, "linked": False}
    assert client.post("/me/telegram/link", headers=api.h(token)).status_code == 503


def test_link_and_unlink(api, client, tg):
    token, user = api.register("998901234567")
    assert client.get("/me/telegram", headers=api.h(token)).json() == {"configured": True, "linked": False}
    _link_user(api, client, token)
    assert client.get("/me/telegram", headers=api.h(token)).json()["linked"] is True
    assert any("ulandi" in t for t in tg.sent_to(USER_TG))
    assert client.delete("/me/telegram", headers=api.h(token)).status_code == 200
    assert client.get("/me/telegram", headers=api.h(token)).json()["linked"] is False


def test_bad_start_token(tg):
    telegram.handle_update({"message": {"chat": {"id": 9}, "from": {"id": 9}, "text": "/start yoq-token"}})
    assert any("eskirgan" in t for t in tg.sent_to(9))


def test_id_command(tg):
    telegram.handle_update({"message": {"chat": {"id": 7}, "from": {"id": 7}, "text": "/id"}})
    assert any("7" in t for t in tg.sent_to(7))


def test_new_application_goes_to_admins_with_buttons(api, client, tg):
    token, _ = api.register("998901234567")
    assert client.post("/business/apply", json=api.APPLICATION, headers=api.h(token)).status_code == 201
    msgs = [p for m, p in tg.calls if m == "sendMessage" and p["chat_id"] == ADMIN_TG]
    assert len(msgs) == 1
    assert "Digital Studio" in msgs[0]["text"] and "123456789" in msgs[0]["text"]
    assert "reyestri" in msgs[0]["text"]
    buttons = msgs[0]["reply_markup"]["inline_keyboard"][0]
    assert [b["callback_data"] for b in buttons] == ["ap:a:1", "ap:r:1"]
    db = SessionLocal()
    assert db.query(ApplicationNotification).count() == 1
    db.close()


def test_approve_via_telegram_notifies_owner(api, client, tg):
    token, _ = api.register("998901234567")
    _link_user(api, client, token)
    client.post("/business/apply", json=api.APPLICATION, headers=api.h(token))
    telegram.handle_update(_cb("ap:a:1"))
    assert client.get("/me", headers=api.h(token)).json()["role"] == "business"
    assert any("tasdiqlandi" in t for t in tg.sent_to(USER_TG))
    edited = tg.methods("editMessageText")
    assert edited and "Tasdiqlandi" in edited[-1]["text"] and edited[-1]["reply_markup"] == {"inline_keyboard": []}
    # ikkinchi bosish: allaqachon ko'rib chiqilgan
    tg.calls.clear()
    telegram.handle_update(_cb("ap:a:1"))
    alert = tg.methods("answerCallbackQuery")[0]
    assert alert["show_alert"] is True and "allaqachon" in alert["text"]


def test_reject_via_telegram_asks_reason_and_sends_it(api, client, tg):
    token, _ = api.register("998901234567")
    _link_user(api, client, token)
    client.post("/business/apply", json=api.APPLICATION, headers=api.h(token))

    telegram.handle_update(_cb("ap:r:1"))
    prompt = tg.sent_to(ADMIN_TG)[-1]
    assert telegram.REJECT_PROMPT in prompt and "#1" in prompt
    assert client.get("/business/my-application", headers=api.h(token)).json()["application"]["status"] == "pending"

    reply = {"message": {"chat": {"id": ADMIN_TG}, "from": {"id": ADMIN_TG, "first_name": "Admin"}, "text": "xx", "reply_to_message": {"text": prompt}}}
    telegram.handle_update(reply)  # juda qisqa sabab
    assert any("kamida 5" in t for t in tg.sent_to(ADMIN_TG))
    assert client.get("/business/my-application", headers=api.h(token)).json()["application"]["status"] == "pending"

    reply["message"]["text"] = "STIR raqami noto'g'ri"
    telegram.handle_update(reply)
    app = client.get("/business/my-application", headers=api.h(token)).json()["application"]
    assert app["status"] == "rejected" and app["rejection_reason"] == "STIR raqami noto'g'ri"
    assert any("STIR raqami noto'g'ri" in t for t in tg.sent_to(USER_TG))


def test_non_admin_cannot_decide(api, client, tg):
    token, _ = api.register("998901234567")
    client.post("/business/apply", json=api.APPLICATION, headers=api.h(token))
    telegram.handle_update(_cb("ap:a:1", uid=999))
    assert client.get("/business/my-application", headers=api.h(token)).json()["application"]["status"] == "pending"
    assert "ruxsat" in tg.methods("answerCallbackQuery")[0]["text"]
    # begona odam sabab yozib rad ham eta olmaydi
    reply = {"message": {"chat": {"id": 999}, "from": {"id": 999}, "text": "rad etilsin", "reply_to_message": {"text": "Ariza #1: Rad etish sababini yozing"}}}
    telegram.handle_update(reply)
    assert client.get("/business/my-application", headers=api.h(token)).json()["application"]["status"] == "pending"


def test_app_panel_decision_also_notifies_telegram(api, client, tg):
    token, _ = api.register("998901234567")
    _link_user(api, client, token)
    client.post("/business/apply", json=api.APPLICATION, headers=api.h(token))
    admin = api.make_admin()
    r = client.post("/admin/business-applications/1/reject", json={"reason": "Hujjat yetarli emas"}, headers=api.h(admin))
    assert r.status_code == 200
    assert any("Hujjat yetarli emas" in t for t in tg.sent_to(USER_TG))
    assert tg.methods("editMessageText")


def test_telegram_failure_does_not_break_api(api, client, monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setattr(settings, "TELEGRAM_ADMIN_IDS", [ADMIN_TG])
    monkeypatch.setattr(telegram, "call", lambda *a, **k: None)  # Telegram ishlamayapti
    token, _ = api.register("998901234567")
    assert client.post("/business/apply", json=api.APPLICATION, headers=api.h(token)).status_code == 201
