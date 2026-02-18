import time
import logging
import asyncio
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"


class GraphClient:
    """Microsoft Graph client with token caching, retries, backoff, and pagination."""

    def __init__(self):
        self._token: str | None = None
        self._token_expiry: float = 0

    def _get_client(self) -> httpx.AsyncClient:
        """Create a fresh async client per request context to avoid event loop issues."""
        return httpx.AsyncClient(timeout=30.0)

    async def _acquire_token(self, client: httpx.AsyncClient) -> str:
        now = time.time()
        if self._token and now < self._token_expiry - 60:
            return self._token

        url = TOKEN_URL.format(tenant=settings.TENANT_ID)
        data = {
            "grant_type": "client_credentials",
            "client_id": settings.CLIENT_ID,
            "client_secret": settings.CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default",
        }
        resp = await client.post(url, data=data)
        resp.raise_for_status()
        body = resp.json()
        self._token = body["access_token"]
        self._token_expiry = now + body.get("expires_in", 3600)
        logger.info("Graph token acquired, expires in %ds", body.get("expires_in", 3600))
        return self._token

    async def _request(self, client: httpx.AsyncClient, method: str, url: str, max_retries: int = 3, **kwargs) -> httpx.Response:
        token = await self._acquire_token(client)
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        for attempt in range(max_retries + 1):
            try:
                resp = await client.request(method, url, headers=headers, **kwargs)

                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", 5))
                    logger.warning("Graph 429 throttled, retrying after %ds (attempt %d)", retry_after, attempt + 1)
                    await asyncio.sleep(retry_after)
                    continue

                if resp.status_code >= 500 and attempt < max_retries:
                    wait = 2 ** attempt
                    logger.warning("Graph %d error, retrying in %ds (attempt %d)", resp.status_code, wait, attempt + 1)
                    await asyncio.sleep(wait)
                    continue

                resp.raise_for_status()
                return resp

            except httpx.TransportError as e:
                if attempt < max_retries:
                    wait = 2 ** attempt
                    logger.warning("Graph transport error: %s, retrying in %ds", str(e), wait)
                    await asyncio.sleep(wait)
                    continue
                raise

        raise RuntimeError(f"Graph request failed after {max_retries + 1} attempts: {url}")

    async def get(self, path: str, params: dict | None = None) -> dict:
        url = f"{GRAPH_BASE}{path}" if path.startswith("/") else path
        async with self._get_client() as client:
            resp = await self._request(client, "GET", url, params=params)
            return resp.json()

    async def get_all(self, path: str, params: dict | None = None) -> list[dict]:
        """Paginate through all @odata.nextLink pages."""
        results = []
        url = f"{GRAPH_BASE}{path}" if path.startswith("/") else path
        p = params

        async with self._get_client() as client:
            while url:
                resp = await self._request(client, "GET", url, params=p)
                data = resp.json()
                results.extend(data.get("value", []))
                next_link = data.get("@odata.nextLink")
                url = next_link
                p = None  # nextLink includes query params
                logger.debug("Paginated %d items so far from %s", len(results), path)

        return results

    async def post(self, path: str, json_body: dict | list | None = None) -> dict:
        """Send a POST request to Graph API."""
        url = f"{GRAPH_BASE}{path}" if path.startswith("/") else path
        async with self._get_client() as client:
            resp = await self._request(client, "POST", url, json=json_body)
            if resp.status_code == 204:
                return {}
            return resp.json()

    async def patch(self, path: str, json_body: dict | None = None) -> dict:
        """Send a PATCH request to Graph API."""
        url = f"{GRAPH_BASE}{path}" if path.startswith("/") else path
        async with self._get_client() as client:
            resp = await self._request(client, "PATCH", url, json=json_body)
            if resp.status_code == 204:
                return {}
            return resp.json()

    async def close(self):
        pass  # No persistent client to close


# Singleton
graph_client = GraphClient()
