from datetime import datetime, timedelta, timezone


def test_register_login_me(api, client):
    token, user = api.register("+998 90 123-45-67", "Ali Valiyev")
    assert user["phone"] == "998901234567" and user["role"] == "client"
    r = client.post("/login", json={"phone": "901234567", "password": "password123"})
    assert r.status_code == 200
    r = client.get("/me", headers=api.h(r.json()["access_token"]))
    assert r.status_code == 200 and r.json()["full_name"] == "Ali Valiyev"


def test_register_validation_and_duplicates(api, client):
    api.register("998901234567")
    r = client.post("/register", json={"full_name": "Ali Valiyev", "phone": "998901234567", "password": "password123"})
    assert r.status_code == 409
    r = client.post("/register", json={"full_name": "Ali Valiyev", "phone": "123", "password": "password123"})
    assert r.status_code == 422
    r = client.post("/register", json={"full_name": "Ali Valiyev", "phone": "998901111111", "password": "short"})
    assert r.status_code == 422
    r = client.post("/register", json={"full_name": "Ali Valiyev", "phone": "998901111111", "password": "password123", "email": "yomon"})
    assert r.status_code == 422
    # bo'sh email xato emas
    r = client.post("/register", json={"full_name": "Ali Valiyev", "phone": "998902222222", "password": "password123", "email": ""})
    assert r.status_code == 201


def test_wrong_password_and_rate_limit(api, client):
    api.register("998901234567")
    for _ in range(5):
        assert client.post("/login", json={"phone": "998901234567", "password": "wrong-pass"}).status_code == 401
    assert client.post("/login", json={"phone": "998901234567", "password": "password123"}).status_code == 429


def test_protected_routes_need_token(client):
    assert client.get("/me").status_code == 401
    assert client.get("/admin/stats").status_code == 401
    assert client.get("/orders/my").status_code == 401
    assert client.get("/notifications").status_code == 401


def test_admin_endpoints_forbidden_for_regular_users(api, client):
    token, _ = api.register("998901234567")
    for path in ("/admin/stats", "/admin/users", "/admin/business-applications", "/admin/services"):
        assert client.get(path, headers=api.h(token)).status_code == 403


def test_db_test_disabled_by_default(client):
    assert client.get("/db-test").status_code == 404


def test_expo_web_origin_can_call_api(client):
    origin = "http://10.69.77.1:8081"
    preflight = client.options(
        "/home",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == origin

    response = client.get("/home", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_categories_seeded(client):
    cats = client.get("/categories").json()
    names = [c["name"] for c in cats]
    assert "IT va texnologiya" in names and "Ta'mirlash xizmatlari" in names and "Boshqa xizmatlar" in names


def test_application_flow_approve(api, client):
    token, _ = api.register("998901234567")
    r = client.post("/business/apply", json=api.APPLICATION, headers=api.h(token))
    assert r.status_code == 201
    assert "reyestri" in r.json()["application"]["verification_note"]
    # ikkinchi faol ariza mumkin emas
    assert client.post("/business/apply", json=api.APPLICATION, headers=api.h(token)).status_code == 409
    # biznes hali yo'q -> xizmat qo'sha olmaydi
    assert client.get("/business/services", headers=api.h(token)).status_code == 403

    admin = api.make_admin()
    apps = client.get("/admin/business-applications?status=pending", headers=api.h(admin)).json()
    assert len(apps) == 1
    r = client.post(f"/admin/business-applications/{apps[0]['id']}/approve", headers=api.h(admin))
    assert r.status_code == 200
    assert client.get("/me", headers=api.h(token)).json()["role"] == "business"
    me = client.get("/business/me", headers=api.h(token)).json()
    assert me["business"]["verification"] == {"level": "manual_review", "registry_verified": False}
    assert me["business"]["categories"][0]["id"] == 1
    # qayta ko'rib chiqib bo'lmaydi
    assert client.post(f"/admin/business-applications/{apps[0]['id']}/approve", headers=api.h(admin)).status_code == 400


def test_application_reject_with_reason_and_reapply(api, client):
    token, _ = api.register("998901234567")
    app_id = client.post("/business/apply", json=api.APPLICATION, headers=api.h(token)).json()["application"]["id"]
    admin = api.make_admin()
    r = client.post(f"/admin/business-applications/{app_id}/reject", json={"reason": "abc"}, headers=api.h(admin))
    assert r.status_code == 422  # sabab juda qisqa
    r = client.post(f"/admin/business-applications/{app_id}/reject", json={"reason": "Hujjatlar to'liq emas"}, headers=api.h(admin))
    assert r.status_code == 200
    mine = client.get("/business/my-application", headers=api.h(token)).json()["application"]
    assert mine["status"] == "rejected" and mine["rejection_reason"] == "Hujjatlar to'liq emas"
    # rad etilgandan keyin qayta topshirish mumkin
    assert client.post("/business/apply", json=api.APPLICATION, headers=api.h(token)).status_code == 201


def test_application_private_pdf_and_admin_access(api, client):
    token, _ = api.register("998901234567")
    data = {key: value for key, value in api.APPLICATION.items() if key != "category_ids"}
    data["category_ids"] = ["1"]
    response = client.post(
        "/business/apply-with-document",
        data=data,
        files={"document": ("info.pdf", b"%PDF-1.4\nprivate test document", "application/pdf")},
        headers=api.h(token),
    )
    assert response.status_code == 201, response.text
    application = response.json()["application"]
    assert application["document_available"] is True
    assert application["ai_status"] == "not_configured"
    assert application["categories"][0]["id"] == 1

    admin = api.make_admin()
    assert client.get(
        f"/admin/business-applications/{application['id']}/document-link",
        headers=api.h(token),
    ).status_code == 403
    link = client.get(
        f"/admin/business-applications/{application['id']}/document-link",
        headers=api.h(admin),
    )
    assert link.status_code == 200
    path = link.json()["url"]
    document = client.get(path)
    assert document.status_code == 200
    assert document.content.startswith(b"%PDF-")
    assert client.get(path.split("?")[0]).status_code == 422
    assert client.get(f"/media/{application['id']}.pdf").status_code == 404
    admin_user = client.get("/me", headers=api.h(admin)).json()
    assert client.patch(
        f"/admin/users/{admin_user['id']}/active",
        json={"is_active": False},
        headers=api.h(api.make_admin("998900000098")),
    ).status_code == 200
    assert client.get(path).status_code == 403


def test_avatar_upload_is_authenticated_and_served(client, api):
    token, user = api.register("998901234567")
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
    response = client.put(
        "/me/avatar",
        files={"image": ("avatar.png", png, "image/png")},
        headers=api.h(token),
    )
    assert response.status_code == 200
    avatar_url = response.json()["avatar_url"]
    assert avatar_url.startswith("/media/")
    assert client.get(avatar_url).status_code == 200
    assert client.put(
        "/me/avatar",
        files={"image": ("bad.png", b"not an image", "image/png")},
        headers=api.h(token),
    ).status_code == 415
    assert client.get("/me", headers=api.h(token)).json()["id"] == user["id"]


def test_duplicate_registration_number(api, client):
    t1, _ = api.register("998901111111")
    t2, _ = api.register("998902222222")
    assert client.post("/business/apply", json=api.APPLICATION, headers=api.h(t1)).status_code == 201
    assert client.post("/business/apply", json=api.APPLICATION, headers=api.h(t2)).status_code == 409


def _service(api, client, token, name="Web sayt yaratish", price=500000, category_id=1):
    r = client.post(
        "/business/services",
        json={"name": name, "description": "Tavsif", "price": price, "category_id": category_id},
        headers=api.h(token),
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_service_crud_and_ownership(api, client):
    owner, _ = api.approved_business("998901111111", "111111111", "Biznes A")
    other, _ = api.approved_business("998902222222", "222222222", "Biznes B")
    sid = _service(api, client, owner)

    assert client.get(f"/services/{sid}").status_code == 200
    # boshqa biznes tahrirlay/o'chira olmaydi
    body = {"name": "Hack qilish", "price": 1, "category_id": 1}
    assert client.put(f"/business/services/{sid}", json=body, headers=api.h(other)).status_code == 404
    assert client.delete(f"/business/services/{sid}", headers=api.h(other)).status_code == 404
    assert client.patch(f"/business/services/{sid}/toggle", headers=api.h(other)).status_code == 404

    # egasi tahrirlaydi
    body = {"name": "Yangi nom", "price": 700000, "category_id": 1, "description": "x"}
    assert client.put(f"/business/services/{sid}", json=body, headers=api.h(owner)).status_code == 200
    assert client.get(f"/services/{sid}").json()["name"] == "Yangi nom"

    # noto'g'ri ma'lumotlar
    assert client.post("/business/services", json={"name": "ab", "price": 1, "category_id": 1}, headers=api.h(owner)).status_code == 422
    assert client.post("/business/services", json={"name": "Yaxshi nom", "price": -5, "category_id": 1}, headers=api.h(owner)).status_code == 422
    assert client.post("/business/services", json={"name": "Yaxshi nom", "price": 5, "category_id": 9999}, headers=api.h(owner)).status_code == 400
    assert client.post("/business/services", json={"name": "Yaxshi nom", "price": 5, "category_id": 2}, headers=api.h(owner)).status_code == 400

    # o'chirish/faolsizlantirish
    assert client.patch(f"/business/services/{sid}/toggle", headers=api.h(owner)).json()["is_active"] is False
    assert client.get(f"/services/{sid}").status_code == 404
    assert client.delete(f"/business/services/{sid}", headers=api.h(owner)).status_code == 200
    assert client.get("/business/services", headers=api.h(owner)).json() == []


def test_client_cannot_create_service(api, client):
    token, _ = api.register("998901234567")
    r = client.post("/business/services", json={"name": "Xizmat nomi", "price": 1, "category_id": 1}, headers=api.h(token))
    assert r.status_code == 403


def test_search_filter_sort(api, client):
    owner, _ = api.approved_business("998901111111", "111111111", "Biznes A")
    _service(api, client, owner, "Web sayt yaratish", 500000, 1)
    _service(api, client, owner, "Uy tozalash", 150000, 7)
    _service(api, client, owner, "Logo dizayn", 200000, 3)

    def names(qs):
        return [s["name"] for s in client.get(f"/services?{qs}").json()["items"]]

    assert names("q=tozalash") == ["Uy tozalash"]
    assert names("category_id=3") == ["Logo dizayn"]
    assert names("sort=price_asc") == ["Uy tozalash", "Logo dizayn", "Web sayt yaratish"]
    assert names("sort=price_desc")[0] == "Web sayt yaratish"
    assert names("min_price=180000&max_price=300000") == ["Logo dizayn"]
    assert len(names("city=toshkent")) == 3
    assert names("city=Samarqand") == []
    assert client.get("/services?sort=yomon").status_code == 422


def test_order_flow_and_reviews(api, client):
    owner, _ = api.approved_business("998901111111", "111111111", "Biznes A")
    sid = _service(api, client, owner)
    cust, _ = api.register("998903333333", "Mijoz Birinchi")

    # o'z xizmatiga buyurtma bera olmaydi
    assert client.post("/orders", json={"service_id": sid}, headers=api.h(owner)).status_code == 400
    r = client.post("/orders", json={"service_id": sid, "message": "Salom"}, headers=api.h(cust))
    assert r.status_code == 201
    oid = r.json()["order"]["id"]
    business_notice = client.get("/notifications", headers=api.h(owner)).json()
    assert business_notice["unread_count"] == 1 and business_notice["items"][0]["order_id"] == oid
    assert client.get("/notifications", headers=api.h(cust)).json()["items"] == []
    # faol buyurtma takror bo'lmaydi
    assert client.post("/orders", json={"service_id": sid}, headers=api.h(cust)).status_code == 409

    # yakunlanmagan buyurtmada sharh yo'q
    assert client.post(f"/services/{sid}/reviews", json={"rating": 5}, headers=api.h(cust)).status_code == 403

    # begona biznes buyurtmani boshqara olmaydi
    other, _ = api.approved_business("998902222222", "222222222", "Biznes B")
    assert client.patch(f"/business/orders/{oid}", json={"action": "accept"}, headers=api.h(other)).status_code == 404
    # accept qilmasdan complete bo'lmaydi
    assert client.patch(f"/business/orders/{oid}", json={"action": "complete"}, headers=api.h(owner)).status_code == 400
    assert client.patch(f"/business/orders/{oid}", json={"action": "accept"}, headers=api.h(owner)).status_code == 200
    customer_notice = client.get("/notifications", headers=api.h(cust)).json()
    assert customer_notice["unread_count"] == 1
    notice_id = customer_notice["items"][0]["id"]
    assert client.post(f"/notifications/{notice_id}/read", headers=api.h(owner)).status_code == 404
    assert client.post(f"/notifications/{notice_id}/read", headers=api.h(cust)).status_code == 200
    assert client.get("/notifications", headers=api.h(cust)).json()["unread_count"] == 0
    assert client.patch(f"/business/orders/{oid}", json={"action": "complete"}, headers=api.h(owner)).status_code == 200
    assert client.post(f"/orders/{oid}/cancel", headers=api.h(cust)).status_code == 400

    # endi sharh qoldirish mumkin
    assert client.get(f"/services/{sid}/review-eligibility", headers=api.h(cust)).json()["can_review"] is True
    assert client.post(f"/services/{sid}/reviews", json={"rating": 6}, headers=api.h(cust)).status_code == 422
    assert client.post(f"/services/{sid}/reviews", json={"rating": 5, "comment": "Zo'r"}, headers=api.h(cust)).status_code == 201
    assert client.post(f"/services/{sid}/reviews", json={"rating": 4}, headers=api.h(cust)).status_code == 409
    review_id = client.get(f"/services/{sid}/reviews").json()[0]["id"]
    assert client.patch(f"/business/reviews/{review_id}/reply", json={"response": "Rahmat!"}, headers=api.h(owner)).status_code == 200
    assert client.patch(f"/business/reviews/{review_id}/reply", json={"response": "Yaxshi"}, headers=api.h(other)).status_code == 404
    assert client.patch(f"/business/reviews/{review_id}/reply", json={"response": "  "}, headers=api.h(owner)).status_code == 422
    assert client.get(f"/services/{sid}/reviews").json()[0]["business_response"] == "Rahmat!"
    assert client.get("/notifications", headers=api.h(cust)).json()["items"][0]["kind"] == "review_reply"
    detail = client.get(f"/services/{sid}").json()
    assert detail["rating"] == 5.0 and detail["review_count"] == 1
    assert client.get(f"/services/{sid}/reviews").json()[0]["user_name"] == "Mijoz B."

    my = client.get("/orders/my", headers=api.h(cust)).json()
    assert my[0]["status"] == "completed"
    stats = client.get("/business/me", headers=api.h(owner)).json()["stats"]
    assert stats["orders"]["completed"] == 1 and stats["total_services"] == 1
    assert stats["orders_last_30_days"] == 1
    assert stats["completed_last_30_days"] == 1
    assert stats["revenue_last_30_days"] == 500000


def test_order_reject_cancel_and_deleted_service(api, client):
    owner, _ = api.approved_business("998901111111", "111111111", "Biznes A")
    sid = _service(api, client, owner)
    cust, _ = api.register("998903333333")
    oid = client.post("/orders", json={"service_id": sid}, headers=api.h(cust)).json()["order"]["id"]
    # sababsiz rad etib bo'lmaydi
    assert client.patch(f"/business/orders/{oid}", json={"action": "reject"}, headers=api.h(owner)).status_code == 422
    r = client.patch(f"/business/orders/{oid}", json={"action": "reject", "reason": "Band"}, headers=api.h(owner))
    assert r.status_code == 200
    assert client.get("/orders/my", headers=api.h(cust)).json()[0]["rejection_reason"] == "Band"

    oid2 = client.post("/orders", json={"service_id": sid}, headers=api.h(cust)).json()["order"]["id"]
    assert client.post(f"/orders/{oid2}/cancel", headers=api.h(cust)).status_code == 200
    # xizmat o'chirilsa, buyurtma tarixi qoladi
    assert client.delete(f"/business/services/{sid}", headers=api.h(owner)).status_code == 200
    assert len(client.get("/orders/my", headers=api.h(cust)).json()) == 2


def test_favorites(api, client):
    owner, _ = api.approved_business("998901111111", "111111111", "Biznes A")
    sid = _service(api, client, owner)
    cust, _ = api.register("998903333333")
    assert client.post(f"/favorites/{sid}", headers=api.h(cust)).status_code == 201
    assert client.post(f"/favorites/{sid}", headers=api.h(cust)).status_code == 201  # takror xato emas
    favs = client.get("/favorites", headers=api.h(cust)).json()
    assert len(favs) == 1 and favs[0]["is_favorite"] is True
    assert client.get(f"/services/{sid}", headers=api.h(cust)).json()["is_favorite"] is True
    assert client.get(f"/services/{sid}").json()["is_favorite"] is False
    assert client.delete(f"/favorites/{sid}", headers=api.h(cust)).status_code == 200
    assert client.get("/favorites", headers=api.h(cust)).json() == []
    assert client.post("/favorites/99999", headers=api.h(cust)).status_code == 404


def test_admin_moderation(api, client):
    owner, admin = api.approved_business("998901111111", "111111111", "Biznes A")
    sid = _service(api, client, owner)
    cust, cu = api.register("998903333333")

    # admin xizmatni bloklaydi -> ommaviy ro'yxatdan yo'qoladi
    assert client.patch(f"/admin/services/{sid}/block", json={"is_blocked": True}, headers=api.h(admin)).status_code == 200
    assert client.get(f"/services/{sid}").status_code == 404
    assert client.post("/orders", json={"service_id": sid}, headers=api.h(cust)).status_code == 404
    assert client.patch(f"/admin/services/{sid}/block", json={"is_blocked": False}, headers=api.h(admin)).status_code == 200
    assert client.get(f"/services/{sid}").status_code == 200

    # foydalanuvchini bloklash
    assert client.patch(f"/admin/users/{cu['id']}/active", json={"is_active": False}, headers=api.h(admin)).status_code == 200
    assert client.get("/me", headers=api.h(cust)).status_code == 403
    assert client.post("/login", json={"phone": "998903333333", "password": "password123"}).status_code == 403

    # o'zini bloklay olmaydi
    me = client.get("/me", headers=api.h(admin)).json()
    assert client.patch(f"/admin/users/{me['id']}/active", json={"is_active": False}, headers=api.h(admin)).status_code == 400

    # biznesni bloklash xizmatlarni yashiradi
    biz = client.get("/admin/businesses", headers=api.h(admin)).json()[0]
    client.patch(f"/admin/businesses/{biz['id']}/active", json={"is_active": False}, headers=api.h(admin))
    assert client.get(f"/services/{sid}").status_code == 404
    assert client.get(f"/businesses/{biz['id']}").status_code == 404

    stats = client.get("/admin/stats", headers=api.h(admin)).json()
    assert stats["services"] == 1 and stats["applications"]["approved"] == 1


def test_home_feed_and_business_pages(api, client):
    owner, admin = api.approved_business("998901111111", "111111111", "Biznes A")
    _service(api, client, owner)
    biz = client.get("/businesses").json()
    assert len(biz) == 1
    bid = biz[0]["id"]
    detail = client.get(f"/businesses/{bid}").json()
    assert detail["business"]["services_count"] == 1 and len(detail["services"]) == 1

    home = client.get("/home").json()
    assert len(home["recent"]) == 1 and home["featured_businesses"] == []
    assert len(home["recommended_businesses"]) == 1
    client.patch(f"/admin/businesses/{bid}/featured", json={"is_featured": True}, headers=api.h(admin))
    assert len(client.get("/home").json()["featured_businesses"]) == 1


def test_business_profile_update(api, client):
    owner, _ = api.approved_business("998901111111", "111111111", "Biznes A")
    r = client.put(
        "/business/me",
        json={"description": "Tavsif", "phone": "998712223344", "city": "Samarqand", "address": "Registon 5", "logo": "ftp://x"},
        headers=api.h(owner),
    )
    assert r.status_code == 422  # logo http(s) bo'lishi kerak
    r = client.put(
        "/business/me",
        json={
            "description": "Tavsif",
            "phone": "998712223344",
            "city": "Samarqand",
            "address": "Registon 5",
            "working_hours": "Du-Sha 09:00-18:00",
            "portfolio_images": ["https://example.com/ish.png"],
            "maps_url": "https://maps.google.com/?q=1,2",
        },
        headers=api.h(owner),
    )
    assert r.status_code == 200
    business = client.get("/business/me", headers=api.h(owner)).json()["business"]
    assert business["city"] == "Samarqand"
    assert business["working_hours"] == "Du-Sha 09:00-18:00"
    assert business["portfolio_images"] == ["https://example.com/ish.png"]
    assert business["maps_url"] == "https://maps.google.com/?q=1,2"


def test_content_reports_are_moderated(api, client):
    owner, admin = api.approved_business("998901111111", "111111111", "Biznes A")
    sid = _service(api, client, owner)
    customer, _ = api.register("998903333333")
    assert client.post(
        "/reports",
        json={"service_id": sid, "reason": "Xizmat tavsifi noto‘g‘ri"},
        headers=api.h(owner),
    ).status_code == 400
    assert client.post(
        "/reports",
        json={"service_id": sid, "business_id": 1, "reason": "Ikki obyektni bildiraman"},
        headers=api.h(customer),
    ).status_code == 422
    report = client.post(
        "/reports",
        json={"service_id": sid, "reason": "Xizmat tavsifi noto‘g‘ri"},
        headers=api.h(customer),
    )
    assert report.status_code == 201
    assert client.post(
        "/reports",
        json={"service_id": sid, "reason": "Yana takroriy shikoyat"},
        headers=api.h(customer),
    ).status_code == 409
    assert client.get("/admin/reports", headers=api.h(admin)).json()[0]["service_name"] == "Web sayt yaratish"
    assert client.patch(f"/admin/reports/{report.json()['id']}", json={"status": "resolved"}, headers=api.h(admin)).status_code == 200
    assert client.get("/admin/reports", headers=api.h(admin)).json() == []
    assert client.patch(f"/admin/reports/{report.json()['id']}", json={"status": "dismissed"}, headers=api.h(admin)).status_code == 409


def test_service_request_offer_flow(api, client):
    owner, _ = api.approved_business("998901111111", "111111111", "Biznes A")
    customer, _ = api.register("998903333333", "Mijoz Birinchi")
    request = client.post(
        "/service-requests",
        json={
            "category_id": 1,
            "title": "Kichik internet do‘kon kerak",
            "description": "Mahsulotlarim uchun to‘lovli internet do‘kon yaratish kerak.",
            "city": "Toshkent",
            "budget_min": 200000,
            "budget_max": 1000000,
        },
        headers=api.h(customer),
    )
    assert request.status_code == 201, request.text
    request_id = request.json()["id"]
    assert client.get("/service-requests", headers=api.h(owner)).json()[0]["id"] == request_id
    offer = client.post(
        f"/service-requests/{request_id}/offers",
        json={"price": 650000, "duration_days": 7, "message": "Do‘konni mobilga mos qilib tayyorlab beramiz."},
        headers=api.h(owner),
    )
    assert offer.status_code == 201, offer.text
    detail = client.get(f"/service-requests/{request_id}", headers=api.h(customer))
    assert detail.status_code == 200 and detail.json()["offers"][0]["price"] == 650000
    assert client.get(f"/service-requests/{request_id}", headers=api.h(owner)).status_code == 200
    selected = client.post(f"/service-offers/{offer.json()['id']}/select", headers=api.h(customer))
    assert selected.status_code == 200, selected.text
    assert selected.json()["order"]["business"]["id"] == client.get("/business/me", headers=api.h(owner)).json()["business"]["id"]
    assert client.post(f"/service-offers/{offer.json()['id']}/select", headers=api.h(customer)).status_code == 409
    assert client.get("/service-requests", headers=api.h(customer)).json()[0]["status"] == "awarded"

    second_request = client.post(
        "/service-requests",
        json={
            "title": "Yana bir xizmat kerak",
            "description": "Ikkinchi so‘rov.",
            "city": "Toshkent",
        },
        headers=api.h(customer),
    )
    second_request_id = second_request.json()["id"]
    assert client.post(f"/service-requests/{second_request_id}/close", headers=api.h(owner)).status_code == 404
    closed = client.post(f"/service-requests/{second_request_id}/close", headers=api.h(customer))
    assert closed.status_code == 200 and closed.json()["status"] == "closed"
    assert client.post(f"/service-requests/{second_request_id}/close", headers=api.h(customer)).status_code == 404


def test_booking_chat_coupon_loyalty_and_match(api, client):
    owner, _ = api.approved_business("998901111111", "111111111", "Biznes A")
    service_id = _service(api, client, owner)
    customer, _ = api.register("998903333333", "Mijoz Birinchi")
    starts = datetime.now(timezone.utc) + timedelta(days=2)
    ends = starts + timedelta(hours=1)
    slot_response = client.post(
        "/business/availability",
        json={"starts_at": starts.isoformat(), "ends_at": ends.isoformat()},
        headers=api.h(owner),
    )
    assert slot_response.status_code == 201, slot_response.text
    slot_id = slot_response.json()["id"]
    assert client.post(
        "/business/availability",
        json={"starts_at": (starts + timedelta(minutes=30)).isoformat(), "ends_at": (ends + timedelta(minutes=30)).isoformat()},
        headers=api.h(owner),
    ).status_code == 409
    coupon = client.post(
        "/business/coupons",
        json={"code": "HELLO10", "discount_type": "percent", "value": 10, "max_redemptions": 10},
        headers=api.h(owner),
    )
    assert coupon.status_code == 201, coupon.text
    order_response = client.post(
        "/orders",
        json={"service_id": service_id, "booking_slot_id": slot_id, "coupon_code": "hello10"},
        headers=api.h(customer),
    )
    assert order_response.status_code == 201, order_response.text
    order = order_response.json()["order"]
    assert order["booking_slot_id"] == slot_id and order["discount_amount"] == 50000
    assert client.get(f"/businesses/{order['business']['id']}/slots").json() == []
    assert client.post(
        f"/orders/{order['id']}/messages",
        json={"body": "Salom, buyurtma shartlarini kelishib olaylik."},
        headers=api.h(customer),
    ).status_code == 201
    messages = client.get(f"/orders/{order['id']}/messages", headers=api.h(owner))
    assert messages.status_code == 200 and messages.json()[0]["body"].startswith("Salom")
    stranger, _ = api.register("998904444444")
    assert client.get(f"/orders/{order['id']}/messages", headers=api.h(stranger)).status_code == 404

    deadline = datetime.now(timezone.utc) + timedelta(days=4)
    accepted = client.patch(
        f"/business/orders/{order['id']}",
        json={
            "action": "accept",
            "agreed_scope": "Do‘kon dizayni va boshlang‘ich katalog.",
            "deadline_at": deadline.isoformat(),
            "final_price": 500000,
        },
        headers=api.h(owner),
    )
    assert accepted.status_code == 200, accepted.text
    assert client.patch(f"/business/orders/{order['id']}", json={"action": "complete"}, headers=api.h(owner)).status_code == 200
    loyalty = client.get("/loyalty/me", headers=api.h(customer)).json()
    assert loyalty["points"] == 50

    second_order = client.post(
        "/orders",
        json={"service_id": service_id, "redeem_points": True},
        headers=api.h(customer),
    )
    assert second_order.status_code == 201, second_order.text
    assert second_order.json()["order"]["redeemed_points"] == 50
    assert second_order.json()["order"]["price"] == 495000
    assert client.post(
        "/orders",
        json={"service_id": service_id, "coupon_code": "BADCODE"},
        headers=api.h(stranger),
    ).status_code == 400
    match = client.post("/match", json={"query": "internet do‘kon", "use_ai": False})
    assert match.status_code == 200


def test_push_token_and_coupon_rules(api, client):
    customer, _ = api.register("998903333333", "Mijoz Birinchi")
    response = client.put(
        "/push-token",
        json={"token": "ExpoPushToken[abc1234567890123456789]", "device_id": "phone-1"},
        headers=api.h(customer),
    )
    assert response.status_code == 200
    assert client.delete(
        "/push-token",
        params={"token": "ExpoPushToken[abc1234567890123456789]"},
        headers=api.h(customer),
    ).json()["registered"] is False
    assert client.put(
        "/push-token",
        json={"token": "bad-token"},
        headers=api.h(customer),
    ).status_code == 422
