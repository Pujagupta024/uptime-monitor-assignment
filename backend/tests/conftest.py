import pytest
import aiosqlite
import tempfile
import os
from fastapi.testclient import TestClient
from unittest.mock import patch

@pytest.fixture(autouse=True)
async def mock_db_url(monkeypatch):
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    monkeypatch.setattr("main.DATABASE_URL", path)
    
    import main
    await main.init_db()
    
    yield
    
    os.remove(path)

@pytest.fixture
def client():
    import main
    with TestClient(main.app) as c:
        yield c
