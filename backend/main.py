from fastapi import FastAPI

app = FastAPI(title="MarsWalk API")


@app.get("/api/mission")
def mission():
    return {
        "mission": "Jezero Expedition",
        "location": "Jezero Crater",
        "objective": "Study ancient river delta deposits",
        "status": "SIMULATION",
    }
