"""
PayJS payment gateway client.

API docs: https://payjs.cn/apidoc/
"""

import hashlib
import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _sign(params: Dict[str, Any]) -> str:
    """Generate PayJS MD5 signature."""
    raw = "&".join(f"{k}={params[k]}" for k in sorted(params) if params[k] != "")
    raw += f"&key={settings.PAYJS_KEY}"
    return hashlib.md5(raw.encode()).hexdigest().upper()


async def create_order(
    out_trade_no: str,
    total_fee: int,
    body: str,
    notify_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a native payment order on PayJS.
    Returns {code_url, payjs_order_id, ...} or raises on error.
    """
    params: Dict[str, str] = {
        "mchid": settings.PAYJS_MCHID,
        "out_trade_no": out_trade_no,
        "total_fee": str(total_fee),
        "body": body,
        "attach": out_trade_no,
    }
    if notify_url or settings.PAYJS_NOTIFY_URL:
        params["notify_url"] = notify_url or settings.PAYJS_NOTIFY_URL

    params["sign"] = _sign(params)

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{settings.PAYJS_API_URL}/native", data=params)
        resp.raise_for_status()
        data = resp.json()

    if data.get("return_code") != 1:
        logger.error("PayJS create_order failed: %s", data)
        raise RuntimeError(data.get("return_msg", "Payment service error"))

    return {
        "code_url": data["code_url"],
        "payjs_order_id": data["payjs_order_id"],
        "out_trade_no": data["out_trade_no"],
        "total_fee": data["total_fee"],
    }


def verify_callback(params: Dict[str, Any]) -> bool:
    """Verify PayJS callback signature."""
    received_sign = params.pop("sign", "")
    expected_sign = _sign(params)
    return received_sign.upper() == expected_sign.upper()


async def query_order(payjs_order_id: str) -> Dict[str, Any]:
    """Query order status from PayJS."""
    params = {
        "payjs_order_id": payjs_order_id,
    }
    params["sign"] = _sign(params)

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{settings.PAYJS_API_URL}/check", data=params)
        resp.raise_for_status()
        return resp.json()
