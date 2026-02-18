""" BEGIN AUTODOC HEADER
#  File: apps\backend\app\api\routes\templates.py
#  Description: (edit inside USER NOTES below)
# 
#  BEGIN AUTODOC META
#  Version: 0.0.0.3
#  Last-Updated: 2026-02-19 00:30:35
#  Managed-By: autosave.ps1
#  END AUTODOC META
# 
#  BEGIN USER NOTES
#  Your notes here. We will NEVER change this block.
#  END USER NOTES
""" END AUTODOC HEADER

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

