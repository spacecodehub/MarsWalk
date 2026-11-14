from navigation.api import router as navigation_router
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.db import Base, SessionLocal, engine
from models.mission import Mission
from routes import mission


def seed_mission():
    db = SessionLocal()
    try:
        if db.query(Mission).count() == 0:
            db.add(
                Mission(
                    mission="Jezero Expedition",
                    location="Jezero Crater",
                    objective="Study ancient river delta deposits",
                    status="SIMULATION",
                )
            )
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_mission()
    yield


app = FastAPI(title="MarsWalk API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mission.router)
app.include_router(navigation_router, prefix="/api")
