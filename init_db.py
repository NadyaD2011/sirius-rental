from app.database import engine, Base, SessionLocal
from app.models import User
from app.auth import hash_password

def init_db():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                hashed_password=hash_password("admin123"),
                role="admin"
            )
            db.add(admin)
            db.commit()
            print("Администратор создан: admin / admin123")
        else:
            print("Администратор уже существует")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()