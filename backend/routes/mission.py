from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.db import get_db
from models.mission import Mission
from schemas.mission import MissionOut

router = APIRouter(prefix="/api", tags=["mission"])


@router.get("/mission", response_model=MissionOut)
def get_mission(db: Session = Depends(get_db)):
    mission = db.query(Mission).first()
    if mission is None:
        raise HTTPException(
            status_code=404, detail="Mission data not available")
    return mission
