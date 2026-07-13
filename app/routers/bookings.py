from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from app.database import get_db
from app.models import Booking, Room, User
from app.schemas import BookingCreate, BookingOut
from app.auth import get_current_user, require_admin

router = APIRouter()

def check_booking_conflict(db: Session, room_id: int, start_time: datetime, end_time: datetime, exclude_booking_id: int = None):
    query = db.query(Booking).filter(
        Booking.room_id == room_id,
        Booking.status == "active",
        Booking.start_time < end_time,
        Booking.end_time > start_time
    )
    if exclude_booking_id:
        query = query.filter(Booking.id != exclude_booking_id)
    return query.first() is not None

@router.post("/", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    booking: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание бронирования"""
    room = db.query(Room).filter(Room.id == booking.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Пространство не найдено")
    
    if booking.end_time <= booking.start_time:
        raise HTTPException(status_code=400, detail="Время окончания должно быть позже начала")
    
    if check_booking_conflict(db, booking.room_id, booking.start_time, booking.end_time):
        raise HTTPException(status_code=409, detail="Пространство уже занято в указанное время")
    
    db_booking = Booking(
        room_id=booking.room_id,
        user_id=current_user.id,
        start_time=booking.start_time,
        end_time=booking.end_time,
        status="active"
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    return db_booking

@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отмена бронирования (владелец или админ)"""
    db_booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")
    
    if db_booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Нет прав для отмены")
    
    db_booking.status = "cancelled"
    db.commit()
    return None

@router.get("/my", response_model=List[BookingOut])
def get_my_bookings(
    include_cancelled: bool = Query(False, description="Включить отменённые"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Мои бронирования (с опцией показать отменённые)"""
    query = db.query(Booking).filter(Booking.user_id == current_user.id)
    if not include_cancelled:
        query = query.filter(Booking.status == "active")
    return query.order_by(Booking.start_time.desc()).all()

@router.get("/all", response_model=List[BookingOut])
def get_all_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Все бронирования всех пользователей (только для админов)"""
    return db.query(Booking).order_by(Booking.start_time.desc()).all()

@router.get("/room/{room_id}", response_model=List[BookingOut])
def get_room_bookings(
    room_id: int,
    date: Optional[date] = Query(None, description="Дата YYYY-MM-DD"),
    start_date: Optional[date] = Query(None, description="Начало периода"),
    end_date: Optional[date] = Query(None, description="Конец периода"),
    db: Session = Depends(get_db)
):
    """Бронирования комнаты (один день или период)"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Пространство не найдено")
    
    query = db.query(Booking).filter(
        Booking.room_id == room_id,
        Booking.status == "active"
    )
    
    if start_date and end_date:
        start_of_period = datetime.combine(start_date, datetime.min.time())
        end_of_period = datetime.combine(end_date, datetime.max.time())
        query = query.filter(
            Booking.start_time >= start_of_period,
            Booking.start_time <= end_of_period
        )
    elif date:
        start_of_day = datetime.combine(date, datetime.min.time())
        end_of_day = datetime.combine(date, datetime.max.time())
        query = query.filter(
            Booking.start_time >= start_of_day,
            Booking.start_time <= end_of_day
        )
    else:
        raise HTTPException(status_code=400, detail="Укажите date или start_date/end_date")
    
    return query.all()