from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator


class HttpMethod(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"
    HEAD = "HEAD"
    OPTIONS = "OPTIONS"


class ApiRequest(BaseModel):
    url: str = Field(..., examples=["https://dummyjson.com/products"])
    method: str = Field(..., examples=["GET"])
    headers: Optional[Dict[str, str]] = Field(default=None)
    body: Optional[Any] = Field(default=None)
    name: Optional[str] = Field(default=None, description="Optional logical/display name of the sampler")


class CreateTestRequest(BaseModel):
    testName: str = Field(..., min_length=1, max_length=150, examples=["API Discovery Test"])
    baseUrl: Optional[HttpUrl] = Field(default=None, examples=["https://dummyjson.com"])
    url: Optional[HttpUrl] = Field(default=None, examples=["https://dummyjson.com/products"])
    method: Optional[str] = Field(default=None, examples=["GET"])
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
    body: Optional[Any] = Field(default=None)
    discovery: str = Field(default="openapi", description="API discovery method")

    @model_validator(mode="before")
    @classmethod
    def check_url_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # If baseUrl is missing but url is present, copy url to baseUrl
            if not data.get("baseUrl") and data.get("url"):
                data["baseUrl"] = data["url"]
            # If url is missing but baseUrl is present, copy baseUrl to url
            elif not data.get("url") and data.get("baseUrl"):
                data["url"] = data["baseUrl"]
        return data

    @field_validator("testName")
    @classmethod
    def testName_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("testName must not be empty or whitespace-only")
        return v


class CreateTestResponse(BaseModel):
    success: bool
    message: str
    testId: str
    testName: str
    jmxFile: str
    yamlFile: str
    directory: str
    discoveryMode: Optional[str] = None
    endpointsCount: Optional[int] = None
    endpoints: Optional[List[ApiRequest]] = None