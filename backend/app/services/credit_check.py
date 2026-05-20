"""
Project quota guard — check and consume project slots.
"""

import logging

from fastapi import HTTPException, status

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)


def check_can_generate(user: User) -> None:
    """Raise 402 if user has no remaining projects and no free trial."""
    if user.projects_remaining == -1:
        return  # enterprise unlimited
    if user.projects_remaining > 0:
        return
    if not user.free_trial_used:
        return
    raise HTTPException(
        status_code=402,
        detail={
            "message": "项目额度不足，请购买套餐",
            "projects_remaining": user.projects_remaining,
            "plan": user.plan,
        },
    )


async def consume_project(session, user: User, bid_id: str) -> str:
    """
    Consume one project slot for a bid generation.
    Caller must commit the session.
    Returns the plan tier that was used.
    """
    if user.projects_remaining == -1:
        logger.info("Enterprise user — unlimited projects. bid=%s", bid_id)
        return "enterprise"

    if not user.free_trial_used and user.projects_remaining == 0:
        user.free_trial_used = True
        logger.info("Free trial consumed for bid=%s by user=%s", bid_id, user.email)
        return "free_trial"

    if user.projects_remaining > 0:
        user.projects_remaining -= 1
        logger.info(
            "Project consumed for bid=%s by user=%s. Remaining: %d",
            bid_id, user.email, user.projects_remaining,
        )
        return user.plan

    raise HTTPException(status_code=402, detail={"message": "项目额度不足，请购买套餐"})
