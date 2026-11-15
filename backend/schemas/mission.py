from pydantic import BaseModel, ConfigDict


class MissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mission: str
    location: str
    objective: str
    status: str
