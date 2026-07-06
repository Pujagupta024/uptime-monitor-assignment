import pytest

def test_register_url(client):
    response = client.post("/api/urls", json={"url": "https://example.com"})
    assert response.status_code == 200
    assert response.json() == {"message": "URL added successfully"}

def test_register_duplicate_url(client):
    client.post("/api/urls", json={"url": "https://example.com"})
    response = client.post("/api/urls", json={"url": "https://example.com"})
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_register_invalid_url(client):
    response = client.post("/api/urls", json={"url": "google.com"})
    assert response.status_code == 400
    assert "must start with" in response.json()["detail"].lower()

def test_get_urls(client):
    client.post("/api/urls", json={"url": "https://example.com"})
    response = client.get("/api/urls")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["url"] == "https://example.com"
