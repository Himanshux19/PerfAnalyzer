from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator

class HttpMethod(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"
    HEAD = "HEAD"
    OPTIONS = "OPTIONS"


class CreateTestRequest(BaseModel):
    testName: str = Field(..., min_length=1, max_length=150, examples=["Login Test"])
    url: HttpUrl = Field(..., examples=["https://example.com/api/login"])
    method: HttpMethod = Field(default=HttpMethod.GET)
    threads: int = Field(..., gt=0, le=10_000, description="Number of concurrent virtual users")
    rampUp: int = Field(..., ge=0, le=86_400, description="Ramp-up time in seconds")
    duration: int = Field(..., gt=0, le=86_400, description="Test duration in seconds")
    loopCount: int = Field(
        default=-1,
        ge=-1,
        le=1_000_000,
        description="Number of loops per thread. -1 means 'infinite' (bounded by duration).",
    )
    headers: Optional[Dict[str, str]] = Field(default=None)
    body: Optional[Dict[str, Any]] = Field(default=None)

    @field_validator("testName")
    @classmethod
    def testName_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("testName must not be empty or whitespace-only")
        return v

    @field_validator("headers")
    @classmethod
    def headers_keys_not_blank(cls, v):
        if v is None:
            return v
        for k in v:
            if not k or not k.strip():
                raise ValueError("Header names must not be empty")
        return v


class CreateTestResponse(BaseModel):
    success: bool
    message: str
    testId: str
    testName: str
    jmxFile: str
    yamlFile: str
    directory: str