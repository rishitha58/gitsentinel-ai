from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from ..models.llm_handler import llm_handler

router = APIRouter()


class PRData(BaseModel):
    prTitle: str
    prNumber: int
    repoOwner: str
    repoName: str
    authorLogin: str
    prUrl: Optional[str] = None


class AnalyzeRequest(BaseModel):
    diff: str
    prData: PRData


@router.post("/analyze")
async def analyze_code(request: AnalyzeRequest):
    if not request.diff:
        raise HTTPException(status_code=400, detail="Diff cannot be empty")

    if len(request.diff) < 10:
        raise HTTPException(status_code=400, detail="Diff too short")

    print(f"📨 Analyze request for PR #{request.prData.prNumber}")

    try:
        pr_data_dict = request.prData.model_dump()
        analysis = llm_handler.analyze_diff(request.diff, pr_data_dict)
        return analysis

    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    return {
        "status": "AI service running",
        "model": llm_handler.model
    }