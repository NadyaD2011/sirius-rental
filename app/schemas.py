from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    
    model_config = ConfigDict(from_attributes=True)

class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    capacity: int = Field(..., gt=0)
    equipment: List[str] = []

class RoomOut(BaseModel):
    id: int
    name: str
    capacity: int
    equipment: List[str] = []
    
    model_config = ConfigDict(from_attributes=True)

class BookingCreate(BaseModel):
    room_id: int
    start_time: datetime
    end_time: datetime

class BookingOut(BaseModel):
    id: int
    room_id: int
    user_id: int
    start_time: datetime
    end_time: datetime
    status: str
    
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    username: str
    password: str

class ErrorResponse(BaseModel):
    detail: str