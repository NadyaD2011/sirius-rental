const API_URL = window.location.hostname === 'localhost' 
    ? 'http://127.0.0.1:8000' 
    : 'http://localhost:8000';
let token = localStorage.getItem('token');
let currentUser = null;
let scheduleCalendar = null;
let currentScheduleRoomId = null;
let allRooms = [];
let allBookings = [];

window.onload = () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('theme-icon').textContent = '☀️';
    }
    if (token) loadCurrentUser();
};

function toggleTheme() {
    const icon = document.getElementById('theme-icon');
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    icon.textContent = isDark ? '☀️' : '🌙';
}

function pluralize(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
}

function switchAuthTab(tab, event) {
    if (event) {
        event.preventDefault();
        document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
    } else {
        document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
        const tabBtn = document.getElementById('tab-' + tab);
        if (tabBtn) tabBtn.classList.add('active');
    }
    
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    document.getElementById('recover-form').classList.add('hidden');
    document.getElementById('auth-alert').style.display = 'none';
}

function showRecoverForm(event) {
    if (event) event.preventDefault();
    document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('recover-form').classList.remove('hidden');
    document.getElementById('auth-alert').style.display = 'none';
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const alertBox = document.getElementById('auth-alert');

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
        const response = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка входа');
        }
        const data = await response.json();
        token = data.access_token;
        localStorage.setItem('token', token);
        loadCurrentUser();
    } catch (error) {
        alertBox.textContent = error.message;
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
    }
}

async function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const alertBox = document.getElementById('auth-alert');

    try {
        const response = await fetch(`${API_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка регистрации');
        }
        alertBox.textContent = 'Регистрация успешна! Войдите в систему.';
        alertBox.className = 'alert alert-success';
        alertBox.style.display = 'block';
        setTimeout(() => document.querySelector('.auth-tabs button:first-child').click(), 1500);
    } catch (error) {
        alertBox.textContent = error.message;
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
    }
}

async function recoverPassword() {
    const username = document.getElementById('recover-username').value;
    const newPassword = document.getElementById('recover-password').value;
    const alertBox = document.getElementById('auth-alert');

    if (!username || newPassword.length < 6) {
        alertBox.textContent = 'Заполните все поля';
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/recover-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, new_password: newPassword })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка');
        }
        alertBox.textContent = 'Пароль восстановлен! Войдите в систему.';
        alertBox.className = 'alert alert-success';
        alertBox.style.display = 'block';
        setTimeout(() => document.querySelector('.auth-tabs button:first-child').click(), 1500);
    } catch (error) {
        alertBox.textContent = error.message;
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
    }
}

async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки');
        currentUser = await response.json();
        showMainSection();
    } catch (error) { logout(); }
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    location.reload();
}

function showMainSection() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('main-nav').classList.remove('hidden');
    document.getElementById('main-section').classList.remove('hidden');
    document.getElementById('username-display').textContent = currentUser.username;
    document.getElementById('username-display').classList.remove('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');
    
    if (currentUser.role === 'admin') {
        document.getElementById('admin-rooms-tab').classList.remove('hidden');
        document.getElementById('admin-users-tab').classList.remove('hidden');
        document.getElementById('admin-bookings-tab').classList.remove('hidden');
        document.getElementById('admin-stats-tab').classList.remove('hidden');
    }
    loadRooms();
}

function switchTab(tab, event) {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    ['rooms-tab', 'my-bookings-tab', 'search-tab', 'admin-rooms-tab-content', 
     'admin-users-tab-content', 'admin-bookings-tab-content', 'admin-stats-tab-content']
    .forEach(id => document.getElementById(id).classList.add('hidden'));
    
    const tabMap = {
        'rooms': 'rooms-tab',
        'my-bookings': 'my-bookings-tab',
        'search': 'search-tab',
        'admin-rooms': 'admin-rooms-tab-content',
        'admin-users': 'admin-users-tab-content',
        'admin-bookings': 'admin-bookings-tab-content',
        'admin-stats': 'admin-stats-tab-content'
    };
    
    document.getElementById(tabMap[tab]).classList.remove('hidden');
    
    if (tab === 'rooms') loadRooms();
    else if (tab === 'my-bookings') loadMyBookings();
    else if (tab === 'admin-rooms') loadAdminRooms();
    else if (tab === 'admin-users') loadUsersList();
    else if (tab === 'admin-bookings') loadAllBookings();
    else if (tab === 'admin-stats') loadStats();
}

async function loadRooms() {
    try {
        const response = await fetch(`${API_URL}/rooms/`);
        allRooms = await response.json();
        const grid = document.getElementById('rooms-grid');
        grid.innerHTML = '';
        if (allRooms.length === 0) {
            grid.innerHTML = '<p>Нет доступных пространств.</p>';
            return;
        }
        allRooms.forEach(room => {
            const tags = room.equipment && room.equipment.length > 0
                ? room.equipment.map(e => `<span class="tag">${e}</span>`).join('') 
                : '<span class="tag">Без оборудования</span>';
            const card = document.createElement('div');
            card.className = 'room-card';
            card.innerHTML = `
                <h3>${room.name}</h3>
                <p> ${room.capacity} чел.</p>
                <div class="equipment">${tags}</div>
                <div class="room-actions">
                    <button class="btn btn-primary" onclick="openModal(${room.id}, '${room.name}')">Забронировать</button>
                    <button class="btn btn-outline" onclick="openScheduleModal(${room.id}, '${room.name}')">Расписание</button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) { console.error(error); }
}

async function loadMyBookings() {
    const includeCancelled = document.getElementById('show-cancelled').checked;
    try {
        const response = await fetch(`${API_URL}/bookings/my?include_cancelled=${includeCancelled}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const bookings = await response.json();
        const list = document.getElementById('my-bookings-list');
        list.innerHTML = '';
        if (bookings.length === 0) {
            list.innerHTML = '<p>Нет бронирований.</p>';
            return;
        }
        const count = bookings.length;
        const word = pluralize(count, 'бронирование', 'бронирования', 'бронирований');
        list.insertAdjacentHTML('beforebegin', `<p style="color: var(--text-light); margin-top: 1rem;">Всего: ${count} ${word}</p>`);
        
        bookings.forEach(booking => {
            const item = document.createElement('div');
            item.className = 'booking-item';
            item.innerHTML = `
                <div class="booking-info">
                    <h4>Комната #${booking.room_id}</h4>
                    <p>📅 ${new Date(booking.start_time).toLocaleString('ru-RU')} — ${new Date(booking.end_time).toLocaleString('ru-RU')}</p>
                    <span class="booking-status status-${booking.status}">${booking.status === 'active' ? 'Активно' : 'Отменено'}</span>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    ${booking.status === 'active' ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${booking.id})">Отменить</button>` : ''}
                    <button class="btn btn-outline btn-sm" onclick="rebook(${booking.room_id})">Повторить</button>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (error) { console.error(error); }
}

async function cancelBooking(id) {
    if (!confirm('Отменить бронирование?')) return;
    try {
        const response = await fetch(`${API_URL}/bookings/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка отмены');
        loadMyBookings();
    } catch (error) { alert(error.message); }
}

function rebook(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (room) openModal(roomId, room.name);
    switchTab('rooms', document.querySelector('nav button'));
}

async function searchAvailable() {
    const start = document.getElementById('search-start').value;
    const end = document.getElementById('search-end').value;
    const capacity = document.getElementById('search-capacity').value;
    const equipment = document.getElementById('search-equipment').value;

    if (!start || !end) { alert('Укажите время'); return; }

    const params = new URLSearchParams({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString()
    });
    if (capacity) params.append('capacity', capacity);
    if (equipment) {
        equipment.split(',').forEach(eq => {
            if (eq.trim()) params.append('equipment', eq.trim());
        });
    }

    try {
        const response = await fetch(`${API_URL}/rooms/available?${params}`);
        const rooms = await response.json();
        const grid = document.getElementById('search-results');
        grid.innerHTML = '';
        if (rooms.length === 0) {
            grid.innerHTML = '<p>Нет свободных комнат.</p>';
            return;
        }
        rooms.forEach(room => {
            const tags = room.equipment && room.equipment.length > 0
                ? room.equipment.map(e => `<span class="tag">${e}</span>`).join('') 
                : '<span class="tag">Без оборудования</span>';
            const card = document.createElement('div');
            card.className = 'room-card';
            card.innerHTML = `
                <h3>${room.name}</h3>
                <p>👥 ${room.capacity} чел.</p>
                <div class="equipment">${tags}</div>
                <button class="btn btn-primary btn-full" onclick="openModal(${room.id}, '${room.name}')">Забронировать</button>
            `;
            grid.appendChild(card);
        });
    } catch (error) { console.error(error); }
}

async function loadAdminRooms() {
    try {
        const response = await fetch(`${API_URL}/rooms/`);
        const rooms = await response.json();
        const grid = document.getElementById('admin-rooms-grid');
        grid.innerHTML = '';
        rooms.forEach(room => {
            const tags = room.equipment && room.equipment.length > 0
                ? room.equipment.map(e => `<span class="tag">${e}</span>`).join('') 
                : '<span class="tag">Без оборудования</span>';
            const card = document.createElement('div');
            card.className = 'room-card';
            card.innerHTML = `
                <h3>${room.name}</h3>
                <p>👥 ${room.capacity} чел.</p>
                <div class="equipment">${tags}</div>
                <div class="room-actions">
                    <button class="btn btn-outline btn-sm" onclick="openEditRoomModal(${room.id}, '${room.name}', ${room.capacity}, '${room.equipment.join(', ')}')">Редактировать</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRoom(${room.id})">Удалить</button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) { console.error(error); }
}

function openCreateRoomModal() {
    document.getElementById('room-modal-title').textContent = 'Создание комнаты';
    document.getElementById('room-edit-id').value = '';
    document.getElementById('room-name').value = '';
    document.getElementById('room-capacity').value = '';
    document.getElementById('room-equipment').value = '';
    document.getElementById('create-room-modal').classList.add('active');
    document.getElementById('create-room-alert').style.display = 'none';
}

function openEditRoomModal(id, name, capacity, equipment) {
    document.getElementById('room-modal-title').textContent = 'Редактирование комнаты';
    document.getElementById('room-edit-id').value = id;
    document.getElementById('room-name').value = name;
    document.getElementById('room-capacity').value = capacity;
    document.getElementById('room-equipment').value = equipment;
    document.getElementById('create-room-modal').classList.add('active');
    document.getElementById('create-room-alert').style.display = 'none';
}

async function saveRoom() {
    const id = document.getElementById('room-edit-id').value;
    const name = document.getElementById('room-name').value;
    const capacity = document.getElementById('room-capacity').value;
    const equipment = document.getElementById('room-equipment').value;
    const alertBox = document.getElementById('create-room-alert');

    if (!name || !capacity) {
        alertBox.textContent = 'Заполните поля';
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
        return;
    }

    const equipmentList = equipment ? equipment.split(',').map(e => e.trim()).filter(e => e) : [];

    try {
        const url = id ? `${API_URL}/rooms/${id}` : `${API_URL}/rooms/`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, capacity: parseInt(capacity), equipment: equipmentList })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка');
        }
        alertBox.textContent = id ? 'Комната обновлена!' : 'Комната создана!';
        alertBox.className = 'alert alert-success';
        alertBox.style.display = 'block';
        setTimeout(() => { closeModal('create-room-modal'); loadAdminRooms(); }, 1000);
    } catch (error) {
        alertBox.textContent = error.message;
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
    }
}

async function deleteRoom(id) {
    if (!confirm('Удалить комнату?')) return;
    try {
        const response = await fetch(`${API_URL}/rooms/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка удаления');
        loadAdminRooms();
    } catch (error) { alert(error.message); }
}

async function loadUsersList() {
    try {
        const response = await fetch(`${API_URL}/users/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await response.json();
        const list = document.getElementById('users-list');
        list.innerHTML = '';
        users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'booking-item';
            item.innerHTML = `
                <div class="booking-info">
                    <h4>${user.username}</h4>
                    <p>Роль: <span class="tag" style="${user.role === 'admin' ? 'background: #fef3c7; color: #d97706;' : ''}">${user.role === 'admin' ? 'Админ' : 'Пользователь'}</span></p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-outline btn-sm" onclick="openEditUserModal(${user.id}, '${user.username}', '${user.role}')">Редактировать</button>
                    ${user.id !== currentUser.id ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">Удалить</button>` : ''}
                </div>
            `;
            list.appendChild(item);
        });
    } catch (error) { console.error(error); }
}

function openEditUserModal(id, username, role) {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-user-username').value = username;
    document.getElementById('edit-user-role').value = role;
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-modal').classList.add('active');
    document.getElementById('edit-user-alert').style.display = 'none';
}

async function updateUser() {
    const id = document.getElementById('edit-user-id').value;
    const username = document.getElementById('edit-user-username').value;
    const role = document.getElementById('edit-user-role').value;
    const newPassword = document.getElementById('edit-user-password').value;
    const alertBox = document.getElementById('edit-user-alert');

    try {
        const response = await fetch(`${API_URL}/users/${id}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ role })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка');
        }

        if (username !== currentUser.username || id != currentUser.id) {
            const usernameResponse = await fetch(`${API_URL}/users/${id}/username`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ username })
            });
            if (!usernameResponse.ok) {
                const data = await usernameResponse.json();
                throw new Error(data.detail || 'Ошибка изменения имени');
            }
        }

        if (newPassword && newPassword.length >= 6) {
            const passwordResponse = await fetch(`${API_URL}/users/${id}/reset-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ new_password: newPassword })
            });
            if (!passwordResponse.ok) {
                const data = await passwordResponse.json();
                throw new Error(data.detail || 'Ошибка смены пароля');
            }
        }

        alertBox.textContent = 'Пользователь обновлён!';
        alertBox.className = 'alert alert-success';
        alertBox.style.display = 'block';
        setTimeout(() => { closeModal('edit-user-modal'); loadUsersList(); }, 1000);
    } catch (error) {
        alertBox.textContent = error.message;
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
    }
}

async function deleteUser(id) {
    if (!confirm('Удалить пользователя?')) return;
    try {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка удаления');
        }
        loadUsersList();
    } catch (error) { alert(error.message); }
}

function openCreateAccountModal() {
    document.getElementById('create-account-modal').classList.add('active');
    document.getElementById('create-account-alert').style.display = 'none';
    document.getElementById('account-username').value = '';
    document.getElementById('account-password').value = '';
    document.getElementById('account-role').value = 'user';
}

async function createAccount() {
    const username = document.getElementById('account-username').value;
    const password = document.getElementById('account-password').value;
    const role = document.getElementById('account-role').value;
    const alertBox = document.getElementById('create-account-alert');

    if (!username || password.length < 6) {
        alertBox.textContent = 'Заполните поля (пароль мин. 6 символов)';
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/create-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username, password, role })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка');
        }
        alertBox.textContent = 'Аккаунт создан!';
        alertBox.className = 'alert alert-success';
        alertBox.style.display = 'block';
        setTimeout(() => { closeModal('create-account-modal'); loadUsersList(); }, 1000);
    } catch (error) {
        alertBox.textContent = error.message;
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
    }
}

function openProfileModal() {
    document.getElementById('profile-username').value = currentUser.username;
    document.getElementById('profile-role').value = currentUser.role === 'admin' ? 'Администратор' : 'Пользователь';
    document.getElementById('profile-old-password').value = '';
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-modal').classList.add('active');
    document.getElementById('profile-alert').style.display = 'none';
}

async function updateProfile() {
    const username = document.getElementById('profile-username').value;
    const oldPassword = document.getElementById('profile-old-password').value;
    const newPassword = document.getElementById('profile-new-password').value;
    const alertBox = document.getElementById('profile-alert');

    try {
        if (username !== currentUser.username) {
            const response = await fetch(`${API_URL}/users/${currentUser.id}/username`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ username })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Ошибка изменения имени');
            }
        }

        if (oldPassword && newPassword) {
            if (newPassword.length < 6) {
                alertBox.textContent = 'Новый пароль мин. 6 символов';
                alertBox.className = 'alert alert-error';
                alertBox.style.display = 'block';
                return;
            }
            const response = await fetch(`${API_URL}/users/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Ошибка смены пароля');
            }
        }

        alertBox.textContent = 'Профиль обновлён!';
        alertBox.className = 'alert alert-success';
        alertBox.style.display = 'block';
        setTimeout(() => { closeModal('profile-modal'); loadCurrentUser(); }, 1000);
    } catch (error) {
        alertBox.textContent = error.message;
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
    }
}

async function loadAllBookings() {
    try {
        const response = await fetch(`${API_URL}/bookings/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        allBookings = await response.json();
        
        const statusFilter = document.getElementById('filter-status').value;
        const startFilter = document.getElementById('filter-start').value;
        const endFilter = document.getElementById('filter-end').value;
        const equipmentFilter = document.getElementById('filter-equipment').value.toLowerCase();
        const capacityFilter = document.getElementById('filter-capacity').value;

        let filtered = allBookings;
        
        if (statusFilter !== 'all') {
            if (statusFilter === 'completed') {
                const now = new Date();
                filtered = filtered.filter(b => b.status === 'active' && new Date(b.end_time) < now);
            } else {
                filtered = filtered.filter(b => b.status === statusFilter);
            }
        }
        
        if (startFilter) {
            filtered = filtered.filter(b => new Date(b.start_time) >= new Date(startFilter));
        }
        if (endFilter) {
            filtered = filtered.filter(b => new Date(b.end_time) <= new Date(endFilter));
        }

        const list = document.getElementById('all-bookings-list');
        list.innerHTML = '';
        
        if (filtered.length === 0) {
            list.innerHTML = '<p>Нет бронирований.</p>';
            return;
        }

        const count = filtered.length;
        const word = pluralize(count, 'бронирование', 'бронирования', 'бронирований');
        
        filtered.forEach(booking => {
            const room = allRooms.find(r => r.id === booking.room_id);
            const roomCapacity = room ? room.capacity : '?';
            const roomEquipment = room && room.equipment && room.equipment.length > 0 ? room.equipment.join(', ') : 'Нет';
            
            if (equipmentFilter && !roomEquipment.toLowerCase().includes(equipmentFilter)) return;
            if (capacityFilter && roomCapacity < parseInt(capacityFilter)) return;
            
            const item = document.createElement('div');
            item.className = 'booking-item';
            item.innerHTML = `
                <div class="booking-info">
                    <h4>Комната #${booking.room_id} (${roomCapacity} чел.) | Пользователь #${booking.user_id}</h4>
                    <p>📅 ${new Date(booking.start_time).toLocaleString('ru-RU')} — ${new Date(booking.end_time).toLocaleString('ru-RU')}</p>
                    <p>🔧 Оборудование: ${roomEquipment}</p>
                    <span class="booking-status status-${booking.status}">${booking.status === 'active' ? 'Активно' : 'Отменено'}</span>
                </div>
                ${booking.status === 'active' ? `<button class="btn btn-danger btn-sm" onclick="adminCancelBooking(${booking.id})">Отменить</button>` : ''}
            `;
            list.appendChild(item);
        });
        
        const finalCount = list.children.length;
        const finalWord = pluralize(finalCount, 'бронирование', 'бронирования', 'бронирований');
        list.insertAdjacentHTML('beforebegin', `<p style="color: var(--text-light); margin-top: 1rem;">Найдено: ${finalCount} ${finalWord}</p>`);
    } catch (error) { console.error(error); }
}

async function adminCancelBooking(id) {
    if (!confirm('Отменить бронирование?')) return;
    try {
        const response = await fetch(`${API_URL}/bookings/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка');
        loadAllBookings();
    } catch (error) { alert(error.message); }
}

async function loadStats() {
    try {
        const [roomsRes, bookingsRes] = await Promise.all([
            fetch(`${API_URL}/rooms/`),
            fetch(`${API_URL}/bookings/all`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const rooms = await roomsRes.json();
        const bookings = await bookingsRes.json();

        const activeBookings = bookings.filter(b => b.status === 'active');
        const today = new Date().toISOString().split('T')[0];
        const todayBookings = activeBookings.filter(b => b.start_time.startsWith(today));

        const roomStats = {};
        activeBookings.forEach(b => {
            roomStats[b.room_id] = (roomStats[b.room_id] || 0) + 1;
        });
        const popularRooms = Object.entries(roomStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        const statsGrid = document.getElementById('stats-grid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${rooms.length}</div>
                <div class="stat-label">Всего комнат</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${activeBookings.length}</div>
                <div class="stat-label">Активных бронирований</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${todayBookings.length}</div>
                <div class="stat-label">Бронирований сегодня</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${bookings.filter(b => b.status === 'cancelled').length}</div>
                <div class="stat-label">Отменено</div>
            </div>
        `;

        const popularDiv = document.getElementById('popular-rooms');
        popularDiv.innerHTML = '';
        if (popularRooms.length === 0) {
            popularDiv.innerHTML = '<p>Нет данных</p>';
        } else {
            popularRooms.forEach(([roomId, count]) => {
                const room = rooms.find(r => r.id == roomId);
                const card = document.createElement('div');
                card.className = 'popular-room-card';
                card.innerHTML = `
                    <h4>${room ? room.name : `Комната #${roomId}`}</h4>
                    <div class="count">${count}</div>
                    <div style="color: var(--text-light); font-size: 0.75rem;">бронирований</div>
                `;
                popularDiv.appendChild(card);
            });
        }
    } catch (error) { console.error(error); }
}

function openScheduleModal(roomId, roomName) {
    currentScheduleRoomId = roomId;
    document.getElementById('schedule-room-name').textContent = roomName;
    document.getElementById('schedule-modal').classList.add('active');
    
    if (!scheduleCalendar) {
        const calendarEl = document.getElementById('schedule-calendar');
        scheduleCalendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            locale: 'ru',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            height: '100%',
            buttonText: {
                today: 'Сегодня',
                month: 'Месяц',
                week: 'Неделя',
                day: 'День'
            },
            events: function(info, successCallback, failureCallback) {
                const start = info.startStr.split('T')[0];
                const end = info.endStr.split('T')[0];
                fetch(`${API_URL}/bookings/room/${currentScheduleRoomId}?start_date=${start}&end_date=${end}`)
                    .then(r => r.json())
                    .then(data => {
                        successCallback(data.map(b => ({
                            id: b.id,
                            title: `Занято (Пользователь #${b.user_id})`,
                            start: b.start_time,
                            end: b.end_time,
                            backgroundColor: '#ef4444',
                            borderColor: '#dc2626'
                        })));
                    })
                    .catch(err => failureCallback(err));
            },
            eventClick: function(info) {
                alert(`Бронирование #${info.event.id}\nНачало: ${info.event.start.toLocaleString('ru-RU')}\nКонец: ${info.event.end.toLocaleString('ru-RU')}`);
            }
        });
        scheduleCalendar.render();
    } else {
        scheduleCalendar.refetchEvents();
    }
}

function openModal(roomId, roomName) {
    document.getElementById('booking-room-id').value = roomId;
    document.getElementById('modal-room-name').textContent = roomName;
    document.getElementById('booking-modal').classList.add('active');
    document.getElementById('booking-alert').style.display = 'none';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

async function createBooking() {
    const roomId = parseInt(document.getElementById('booking-room-id').value);
    const startTime = document.getElementById('booking-start').value;
    const endTime = document.getElementById('booking-end').value;
    const alertBox = document.getElementById('booking-alert');

    if (!startTime || !endTime) {
        alertBox.textContent = 'Укажите время';
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/bookings/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                room_id: roomId,
                start_time: new Date(startTime).toISOString(),
                end_time: new Date(endTime).toISOString()
            })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Ошибка');
        }
        alertBox.textContent = 'Успешно!';
        alertBox.className = 'alert alert-success';
        alertBox.style.display = 'block';
        setTimeout(() => closeModal('booking-modal'), 1500);
    } catch (error) {
        alertBox.textContent = error.message;
        alertBox.className = 'alert alert-error';
        alertBox.style.display = 'block';
    }
}