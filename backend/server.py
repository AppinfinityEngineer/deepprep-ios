"""DeepPrep FastAPI entrypoint (ThoughtSnap Labs).

Runnable locally with mock search + real LLM synthesis (see README). All routes
are prefixed with /api to match the platform ingress.
"""
import logging
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import APIRouter, FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from dp.router import deepprep_router  # noqa: E402
from dp import db as dp_db  # noqa: E402

app = FastAPI(title="DeepPrep API", version="3.0.0")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "DeepPrep API", "status": "ok"}


api_router.include_router(deepprep_router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("deepprep")


@app.on_event("shutdown")
async def shutdown_db_client():
    dp_db.close()
