from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut, Token
from app.auth import hash_password, verify_password, create_access_token, get_current_user, require_admin
from pydantic import BaseModel, Field

router = APIRouter()

class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)

class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=6)

class RoleUpdate(BaseModel):
    role: str

class UsernameUpdate(BaseModel):
    username: str

class AccountCreate(BaseModel):
    username: str
    password: str = Field(..., min_length=6)
    role: str = "user"

class PasswordRecover(BaseModel):
    username: str
    new_password: str = Field(..., min_length=6)

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Пользователь уже существует")
    
    db_user = User(
        username=user.username,
        hashed_password=hash_password(user.password),
        role="user"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/create-account", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_account(
    account: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Создание аккаунта с выбором роли (только для админов)"""
    existing = db.query(User).filter(User.username == account.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Пользователь уже существует")
    
    if account.role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Роль должна быть 'user' или 'admin'")
    
    db_user = User(
        username=account.username,
        hashed_password=hash_password(account.password),
        role=account.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/list", response_model=list[UserOut])
def get_users_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Список всех пользователей (только для админов)"""
    return db.query(User).all()

@router.put("/{user_id}/role")
def update_user_role(
    user_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Изменение роли пользователя (только для админов)"""
    if role_data.role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Роль должна быть 'user' или 'admin'")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user.role = role_data.role
    db.commit()
    return {"message": f"Роль пользователя {user.username} изменена на {role_data.role}"}

@router.put("/{user_id}/username")
def update_username(
    user_id: int,
    data: UsernameUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Изменение имени пользователя"""
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Нет прав")
    
    existing = db.query(User).filter(User.username == data.username, User.id != user_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Имя уже занято")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user.username = data.username
    db.commit()
    return {"message": "Имя изменено"}

@router.post("/change-password")
def change_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Смена пароля текущего пользователя"""
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Пароль изменён"}

@router.put("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Сброс пароля пользователя (только для админов)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": f"Пароль пользователя {user.username} изменён"}

@router.post("/recover-password")
def recover_password(
    data: PasswordRecover,
    db: Session = Depends(get_db)
):
    """Восстановление пароля по имени пользователя"""
    user = db.query(User).filter(User.username == data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Пароль восстановлен"}

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Удаление пользователя (только для админов)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить себя")
    
    db.delete(user)
    db.commit()
    return None

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Вход и получение JWT токена"""
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Информация о текущем пользователе"""
    return current_user