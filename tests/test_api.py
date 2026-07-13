import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import engine, Base, get_db
from app.models import Room, Booking, User
from app.auth import hash_password
from datetime import datetime, timedelta
from sqlalchemy.orm import sessionmaker

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)
client = TestClient(app)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="function")
def auth_token(db_session):
    user = User(
        username="testuser",
        hashed_password=hash_password("testpass"),
        role="user"
    )
    db_session.add(user)
    db_session.commit()
    
    response = client.post("/users/login", data={
        "username": "testuser",
        "password": "testpass"
    })
    return response.json()["access_token"]

@pytest.fixture(scope="function")
def test_room(db_session):
    room = Room(
        name="Test Room",
        capacity=10,
        equipment="projector, whiteboard"
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)
    return room

def test_create_room(db_session):
    admin = User(
        username="testadmin",
        hashed_password=hash_password("testpass"),
        role="admin"
    )
    db_session.add(admin)
    db_session.commit()
    
    login_response = client.post("/users/login", data={
        "username": "testadmin",
        "password": "testpass"
    })
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    room_data = {
        "name": "Conference Room A",
        "capacity": 8,
        "equipment": ["TV", "conference call"]
    }
    response = client.post("/rooms/", json=room_data, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == room_data["name"]
    assert data["capacity"] == room_data["capacity"]
    assert "id" in data

def test_get_rooms(db_session, test_room):
    response = client.get("/rooms/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_create_booking(db_session, test_room, auth_token):
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=1)
    
    booking_data = {
        "room_id": test_room.id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat()
    }
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = client.post("/bookings/", json=booking_data, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["room_id"] == test_room.id
    assert data["status"] == "active"

def test_booking_conflict(db_session, test_room, auth_token):
    start_time = datetime.now() + timedelta(days=2)
    end_time = start_time + timedelta(hours=2)
    
    booking_data = {
        "room_id": test_room.id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat()
    }
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    response1 = client.post("/bookings/", json=booking_data, headers=headers)
    assert response1.status_code == 201
    
    conflicting_booking = {
        "room_id": test_room.id,
        "start_time": (start_time + timedelta(minutes=30)).isoformat(),
        "end_time": (end_time + timedelta(minutes=30)).isoformat()
    }
    
    response2 = client.post("/bookings/", json=conflicting_booking, headers=headers)
    assert response2.status_code == 409
    assert "занято" in response2.json()["detail"].lower()

def test_get_available_rooms(db_session, test_room, auth_token):
    start_time = datetime.now() + timedelta(days=3)
    end_time = start_time + timedelta(hours=1)
    
    booking_data = {
        "room_id": test_room.id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat()
    }
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    client.post("/bookings/", json=booking_data, headers=headers)
    
    response = client.get(
        "/rooms/available",
        params={"start": start_time.isoformat(), "end": end_time.isoformat()}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0
    
    other_time_start = datetime.now() + timedelta(days=10)
    other_time_end = other_time_start + timedelta(hours=1)
    
    response = client.get(
        "/rooms/available",
        params={"start": other_time_start.isoformat(), "end": other_time_end.isoformat()}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1