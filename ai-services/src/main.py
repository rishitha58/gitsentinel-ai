from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.analyze_routes import router as analyze_router

app = FastAPI(
    title="GitSentinel AI Microservice",
    description="Code analysis powered by LLMs",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router, prefix="/api/v1", tags=["analysis"])


@app.get("/")
async def root():
    return {"message": "GitSentinel AI Service", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "running"}