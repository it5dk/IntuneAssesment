from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.template import Template
from app.schemas.template import TemplateOut
from app.services.seed import seed_templates

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).order_by(Template.name))
    return result.scalars().all()


@router.post("/seed", response_model=list[TemplateOut])
async def seed(db: AsyncSession = Depends(get_db)):
    templates = await seed_templates(db)
    return templates
