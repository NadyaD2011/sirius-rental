from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import Room, Booking, User
from app.schemas import RoomCreate, RoomOut
from app.auth import get_current_user, require_admin

router = APIRouter()

def equipment_to_str(equipment: List[str]) -> str:
    return ",".join(equipment) if equipment else ""

def str_to_equipment(equipment_str: str) -> List[str]:
    if not equipment_str:
        return []
    return [eq.strip() for eq in equipment_str.split(",") if eq.strip()]

@router.post("/", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_room(
    room: RoomCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    db_room = Room(
        name=room.name,
        capacity=room.capacity,
        equipment=equipment_to_str(room.equipment)
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    result = RoomOut(
        id=db_room.id,
        name=db_room.name,
        capacity=db_room.capacity,
        equipment=str_to_equipment(db_room.equipment)
    )
    return result

@router.get("/", response_model=List[RoomOut])
def get_rooms(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    rooms = db.query(Room).offset(skip).limit(limit).all()
    return [RoomOut(
        id=r.id, name=r.name, capacity=r.capacity,
        equipment=str_to_equipment(r.equipment)
    ) for r in rooms]

@router.get("/available", response_model=List[RoomOut])
def get_available_rooms(
    start: datetime = Query(..., description="Время начала бронирования"),
    end: datetime = Query(..., description="Время окончания бронирования"),
    capacity: Optional[int] = Query(None, ge=1, description="Минимальная вместимость"),
    equipment: Optional[List[str]] = Query(None, description="Список оборудования"),
    db: Session = Depends(get_db)
):
    if end <= start:
        raise HTTPException(status_code=400, detail="Время окончания должно быть позже времени начала")
    
    query = db.query(Room)
    
    if capacity:
        query = query.filter(Room.capacity >= capacity)
    
    rooms = query.all()
    available_rooms = []
    
    for room in rooms:
        if equipment:
            room_equipment = str_to_equipment(room.equipment)
            if not all(eq.lower() in [e.lower() for e in room_equipment] for eq in equipment):
                continue
        
        has_conflict = db.query(Booking).filter(
            Booking.room_id == room.id,
            Booking.status == "active",
            Booking.start_time < end,
            Booking.end_time > start
        ).first()
        
        if not has_conflict:
            available_rooms.append(RoomOut(
                id=room.id, name=room.name, capacity=room.capacity,
                equipment=str_to_equipment(room.equipment)
            ))
    
    return available_rooms

@router.get("/{room_id}", response_model=RoomOut)
def get_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Пространство не найдено")
    return RoomOut(
        id=room.id, name=room.name, capacity=room.capacity,
        equipment=str_to_equipment(room.equipment)
    )

@router.put("/{room_id}", response_model=RoomOut)
def update_room(
    room_id: int, 
    room: RoomCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    db_room = db.query(Room).filter(Room.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Пространство не найдено")
    
    db_room.name = room.name
    db_room.capacity = room.capacity
    db_room.equipment = equipment_to_str(room.equipment)
    db.commit()
    db.refresh(db_room)
    
    return RoomOut(
        id=db_room.id, name=db_room.name, capacity=db_room.capacity,
        equipment=str_to_equipment(db_room.equipment)
    )

@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    db_room = db.query(Room).filter(Room.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Пространство не найдено")
    db.delete(db_room)
    db.commit()
    return None