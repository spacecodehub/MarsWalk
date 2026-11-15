from sqlalchemy import Column, Integer, String
from database.db import Base


class Mission(Base):
    __tablename__ = "missions"

    id = Column(Integer, primary_key=True, index=True)
    mission = Column(String, nullable=False)
    location = Column(String, nullable=False)
    objective = Column(String, nullable=False)
    status = Column(String, nullable=False, default="SIMULATION")
