"""
Payment router — plan subscription, PayJS orders, callback.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.models.user import User
from app.models.order import Order
from app.routers.auth import get_current_user
from app.services.payment.payjs import create_order as payjs_create_order
from app.services.payment.payjs import verify_callback, query_order

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["payment"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreditsResponse(BaseModel):
    credits_balance: int

class UserPlanResponse(BaseModel):
    plan: str
    projects_remaining: int
    free_trial_used: bool


class PlansResponse(BaseModel):
    plans: dict
    free_trial_projects: int


class CreateOrderRequest(BaseModel):
    plan_id: str


class CreateOrderResponse(BaseModel):
    order_id: str
    code_url: str
    amount: int
    plan_id: str
    projects: int


class OrderStatusResponse(BaseModel):
    status: str
    plan_id: str
    projects: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/user/credits", response_model=CreditsResponse)
async def get_user_credits(current_user: User = Depends(get_current_user)):
    """Get the current user"s credits balance."""
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.id == current_user.id)
        )
        user = result.scalar_one()
        return CreditsResponse(
            credits_balance=user.credits_balance,
        )


@router.get("/user/plan", response_model=UserPlanResponse)
async def get_user_plan(current_user: User = Depends(get_current_user)):
    """Get the current user's plan and remaining projects."""
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.id == current_user.id)
        )
        user = result.scalar_one()
        return UserPlanResponse(
            plan=user.plan,
            projects_remaining=user.projects_remaining,
            free_trial_used=user.free_trial_used,
        )


@router.get("/pricing", response_model=PlansResponse)
async def get_pricing():
    """Get available plans and pricing."""
    return PlansResponse(
        plans=settings.PLANS,
        free_trial_projects=settings.FREE_TRIAL_PROJECTS,
    )


@router.post("/orders/create", response_model=CreateOrderResponse)
async def create_recharge_order(
    req: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a subscription order and return PayJS QR code URL."""
    plan = settings.PLANS.get(req.plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan: {req.plan_id}",
        )

    order_id = str(uuid.uuid4())
    total_fee = plan["price_yuan"] * 100  # PayJS uses cents
    projects = plan["projects"]

    try:
        result = await payjs_create_order(
            out_trade_no=order_id,
            total_fee=total_fee,
            body=f"AI投标助手 - {plan['name']}",
        )
    except Exception as e:
        logger.exception("PayJS order creation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Payment service unavailable: {e}",
        )

    async with async_session() as session:
        order = Order(
            id=order_id,
            user_id=current_user.id,
            plan_id=req.plan_id,
            amount=total_fee,
            projects=projects,
            status="pending",
            payjs_order_id=result["payjs_order_id"],
            created_at=datetime.now(timezone.utc),
        )
        session.add(order)
        await session.commit()

    return CreateOrderResponse(
        order_id=order_id,
        code_url=result["code_url"],
        amount=total_fee,
        plan_id=req.plan_id,
        projects=projects,
    )


@router.get("/orders/{order_id}/status", response_model=OrderStatusResponse)
async def get_order_status(
    order_id: str,
    current_user: User = Depends(get_current_user),
):
    """Poll the status of a subscription order."""
    async with async_session() as session:
        result = await session.execute(
            select(Order).where(Order.id == order_id, Order.user_id == current_user.id)
        )
        order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order.status == "pending" and order.payjs_order_id:
        try:
            payjs_result = await query_order(order.payjs_order_id)
            if payjs_result.get("return_code") == 1 and payjs_result.get("status") == 1:
                await _fulfill_order(order_id)
                return OrderStatusResponse(status="paid", plan_id=order.plan_id, projects=order.projects)
        except Exception:
            pass

    return OrderStatusResponse(status=order.status, plan_id=order.plan_id, projects=order.projects)


@router.post("/orders/callback")
async def payment_callback(request: Request):
    """PayJS payment notification webhook."""
    body = await request.body()
    body_str = body.decode("utf-8")

    params = {}
    for pair in body_str.split("&"):
        if "=" in pair:
            k, v = pair.split("=", 1)
            params[k] = v

    if not settings.DEBUG and not verify_callback(params.copy()):
        logger.warning("PayJS callback signature verification failed")
        return {"return_code": 0, "return_msg": "Signature verification failed"}

    out_trade_no = params.get("out_trade_no", "")
    if not out_trade_no:
        return {"return_code": 0, "return_msg": "Missing out_trade_no"}

    await _fulfill_order(out_trade_no)
    return {"return_code": 1, "return_msg": "OK"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fulfill_order(order_id: str) -> None:
    """Mark order as paid and grant projects to user."""
    async with async_session() as session:
        result = await session.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order or order.status == "paid":
            return

        order.status = "paid"
        order.paid_at = datetime.now(timezone.utc)

        user_result = await session.execute(
            select(User).where(User.id == order.user_id)
        )
        user = user_result.scalar_one()
        user.plan = order.plan_id
        user.projects_remaining += order.projects

        await session.commit()

    logger.info(
        "Order %s fulfilled: plan=%s +%d projects for user %s. New balance: %d",
        order_id, order.plan_id, order.projects, user.email, user.projects_remaining,
    )
