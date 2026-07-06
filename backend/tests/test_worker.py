import pytest
import aiosqlite
from unittest.mock import patch, AsyncMock, MagicMock
import httpx
import main
import asyncio

@pytest.mark.asyncio
async def test_ping_urls_healthy():
    async with aiosqlite.connect(main.DATABASE_URL) as db:
        await db.execute("INSERT INTO urls (url) VALUES ('https://healthy.com')")
        await db.commit()
        
    mock_response = MagicMock()
    mock_response.status_code = 200
    
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            mock_sleep.side_effect = Exception("Break loop")
            try:
                await main.ping_urls()
            except Exception as e:
                if str(e) != "Break loop":
                    raise
                    
    async with aiosqlite.connect(main.DATABASE_URL) as db:
        async with db.execute("SELECT status_code, is_up FROM ping_logs WHERE url_id = 1") as cursor:
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] == 200
            assert row[1] == 1 # True

@pytest.mark.asyncio
async def test_ping_urls_missing():
    async with aiosqlite.connect(main.DATABASE_URL) as db:
        await db.execute("INSERT INTO urls (url) VALUES ('https://missing.com')")
        await db.commit()
        
    mock_response = MagicMock()
    mock_response.status_code = 404
    
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            mock_sleep.side_effect = Exception("Break loop")
            try:
                await main.ping_urls()
            except Exception as e:
                if str(e) != "Break loop":
                    raise
                    
    async with aiosqlite.connect(main.DATABASE_URL) as db:
        async with db.execute("SELECT status_code, is_up FROM ping_logs WHERE url_id = 1") as cursor:
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] == 404
            assert row[1] == 1 # True, server responded

@pytest.mark.asyncio
async def test_ping_urls_dns_failure():
    async with aiosqlite.connect(main.DATABASE_URL) as db:
        await db.execute("INSERT INTO urls (url) VALUES ('https://dns-fail.com')")
        await db.commit()
        
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.RequestError("DNS Failure")
        
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            mock_sleep.side_effect = Exception("Break loop")
            try:
                await main.ping_urls()
            except Exception as e:
                if str(e) != "Break loop":
                    raise
                    
    async with aiosqlite.connect(main.DATABASE_URL) as db:
        async with db.execute("SELECT status_code, is_up FROM ping_logs WHERE url_id = 1") as cursor:
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] is None
            assert row[1] == 0 # False
