// ===== НАСТРОЙКА =====
const API_URL = 'https://script.google.com/macros/s/AKfycbw4UYB19CjtRVtG14uz8EI1PhypgvdlKGFlQ6mXEIBj4_-TVk0GWAlYjlEVRmVNJ-7h/exec';
const CACHE_KEY = 'scheduleCache';
const CACHE_TTL = 5 * 60 * 1000;

let allData = [];
let facultyFilter = 'all';
let searchQuery = '';
let selectedGroup = '';
let currentWeek = 1;
let currentType = 'Все'; // 'Все', 'Основное', 'Практика', 'Зачет', 'Экзамен'

const DAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const LESSON_TIMES = ['08:30', '10:10', '11:50', '13:30', '15:10', '16:50', '18:30', '20:10'];

// ===== КЕШИРОВАНИЕ =====
function getCachedData() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TTL) return data;
        } catch (_) {}
    }
    return null;
}
function setCachedData(data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData(force = false) {
    if (!force) {
        const cached = getCachedData();
        if (cached) return cached;
    }
    try {
        const response = await fetch(`${API_URL}?action=getSchedule`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();
        if (!Array.isArray(data)) {
            console.error('Получен не массив:', data);
            alert('Ошибка: сервер вернул не массив данных.');
            return [];
        }
        setCachedData(data);
        return data;
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        alert('Не удалось загрузить расписание.');
        return [];
    }
}

// ===== ИНДИКАТОР =====
function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'block' : 'none';
}

// ===== ФИЛЬТРАЦИЯ =====
function filterData(data) {
    let filtered = data;
    // Фильтр по факультету
    if (facultyFilter !== 'all') {
        filtered = filtered.filter(row => row['Факультет'] === facultyFilter);
    }
    // Поиск
    if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(row =>
            row['Группа'].toLowerCase().includes(q) ||
            row['Преподаватель'].toLowerCase().includes(q)
        );
    }
    // Группа
    if (selectedGroup !== '') {
        filtered = filtered.filter(row => row['Группа'] === selectedGroup);
    }
    // Неделя
    filtered = filtered.filter(row => String(row['Неделя']) === String(currentWeek));
    // Тип (если не 'Все')
    if (currentType !== 'Все') {
        filtered = filtered.filter(row => row['Тип'] === currentType);
    }
    return filtered;
}

// ===== ПОСТРОЕНИЕ ТАБЛИЦЫ =====
function renderTable(filtered) {
    const tbody = document.getElementById('schedule-body');
    const noData = document.getElementById('no-data');
    const container = document.getElementById('schedule-container');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        container.style.display = 'none';
        return;
    }
    noData.style.display = 'none';
    container.style.display = 'block';

    const grid = {};
    filtered.forEach(row => {
        const day = row['День_недели'];
        const lesson = parseInt(row['Номер_пары'], 10);
        if (!day || isNaN(lesson)) return;
        const key = `${day}_${lesson}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push(row);
    });

    let html = '';
    for (let lesson = 1; lesson <= 8; lesson++) {
        html += '<tr>';
        html += `<td class="time-col">${LESSON_TIMES[lesson-1] || ''}</td>`;
        DAYS.forEach(day => {
            const key = `${day}_${lesson}`;
            const cells = grid[key] || [];
            if (cells.length === 0) {
                html += `<td class="empty-cell">—</td>`;
            } else {
                let content = cells.map(cell => {
                    const subject = cell['Дисциплина'] || '';
                    const teacher = cell['Преподаватель'] || '';
                    const room = cell['Аудитория'] || '';
                    const building = cell['Здание'] || '';
                    const type = cell['Вид_занятия'] || '';
                    const typeIcon = type === 'лекция' ? '📘' : type === 'практика' ? '📗' : type === 'лабораторная' ? '📙' : '';
                    return `<div class="lesson-cell">
                                <span class="subject">${subject}</span>
                                <span class="teacher">${teacher}</span>
                                <span class="room">${room} ${building ? 'корп.'+building : ''}</span>
                                <span class="type">${typeIcon} ${type}</span>
                            </div>`;
                }).join('');
                html += `<td>${content}</td>`;
            }
        });
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

// ===== МОБИЛЬНАЯ ВЕРСИЯ =====
function renderMobile(filtered) {
    const container = document.getElementById('schedule-container');
    const noData = document.getElementById('no-data');
    const listContainer = document.getElementById('mobile-list');

    if (filtered.length === 0) {
        listContainer.innerHTML = '';
        noData.style.display = 'block';
        container.style.display = 'none';
        return;
    }
    noData.style.display = 'none';
    container.style.display = 'block';
    listContainer.style.display = 'block';

    const sorted = [...filtered].sort((a,b) => {
        const dayOrder = { 'ПН':1, 'ВТ':2, 'СР':3, 'ЧТ':4, 'ПТ':5, 'СБ':6 };
        return (dayOrder[a['День_недели']] - dayOrder[b['День_недели']]) ||
               (parseInt(a['Номер_пары']) - parseInt(b['Номер_пары']));
    });

    let html = '';
    sorted.forEach(row => {
        const day = row['День_недели'] || '';
        const lesson = row['Номер_пары'] || '';
        const subject = row['Дисциплина'] || '';
        const teacher = row['Преподаватель'] || '';
        const room = row['Аудитория'] || '';
        const building = row['Здание'] || '';
        const type = row['Вид_занятия'] || '';
        const typeIcon = type === 'лекция' ? '📘' : type === 'практика' ? '📗' : type === 'лабораторная' ? '📙' : '';
        html += `<div class="mobile-card">
                    <div class="card-header">
                        <span>${day}</span>
                        <span>${lesson} пара (${LESSON_TIMES[lesson-1] || ''})</span>
                    </div>
                    <div class="card-body">
                        <div><strong>${subject}</strong> <span class="type-badge">${typeIcon} ${type}</span></div>
                        <div>${teacher}</div>
                        <div>${room} ${building ? 'корп.'+building : ''}</div>
                    </div>
                </div>`;
    });
    listContainer.innerHTML = html;
}

// ===== ОБНОВЛЕНИЕ ВЫПАДАЮЩЕГО СПИСКА ГРУПП =====
function updateGroupOptions(data) {
    const select = document.getElementById('groupSelect');
    const currentVal = select.value;
    select.innerHTML = '<option value="">Выберите группу</option>';
    let filtered = data;
    if (facultyFilter !== 'all') {
        filtered = filtered.filter(row => row['Факультет'] === facultyFilter);
    }
    if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(row =>
            row['Группа'].toLowerCase().includes(q) ||
            row['Преподаватель'].toLowerCase().includes(q)
        );
    }
    const groups = [...new Set(filtered.map(row => row['Группа']).filter(Boolean))].sort();
    groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        select.appendChild(opt);
    });
    if ([...select.options].some(opt => opt.value === currentVal)) {
        select.value = currentVal;
    } else {
        select.value = '';
        selectedGroup = '';
    }
}

// ===== ОСНОВНАЯ ФУНКЦИЯ =====
async function refresh(force = false) {
    showLoading(true);
    allData = await loadData(force);
    showLoading(false);
    if (allData.length === 0) return;
    updateGroupOptions(allData);
    const filtered = filterData(allData);
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        renderMobile(filtered);
        document.getElementById('schedule-table').style.display = 'none';
        document.getElementById('mobile-list').style.display = 'block';
    } else {
        renderTable(filtered);
        document.getElementById('schedule-table').style.display = 'table';
        document.getElementById('mobile-list').style.display = 'none';
    }
}

// ===== ОБРАБОТЧИКИ =====
document.addEventListener('DOMContentLoaded', () => {
    // Кнопки выбора типа
    document.querySelectorAll('.type-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentType = this.dataset.type;
            refresh();
        });
    });

    // Факультеты
    document.querySelectorAll('.faculty-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.faculty-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            facultyFilter = this.dataset.faculty;
            document.getElementById('groupSelect').value = '';
            selectedGroup = '';
            refresh();
        });
    });

    // Поиск
    const searchInput = document.getElementById('searchInput');
    let timeoutId;
    searchInput.addEventListener('input', function() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            searchQuery = this.value;
            document.getElementById('groupSelect').value = '';
            selectedGroup = '';
            refresh();
        }, 300);
    });

    // Группа
    document.getElementById('groupSelect').addEventListener('change', function() {
        selectedGroup = this.value;
        if (selectedGroup !== '') {
            searchInput.value = '';
            searchQuery = '';
        }
        refresh();
    });

    // Неделя
    document.querySelectorAll('.week-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.week-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentWeek = parseInt(this.dataset.week, 10);
            refresh();
        });
    });

    // Обновить
    document.getElementById('refreshBtn').addEventListener('click', () => refresh(true));

    // Автообновление
    setInterval(() => refresh(true), 5 * 60 * 1000);

    // Ресайз
    window.addEventListener('resize', () => {
        if (allData.length > 0) {
            const filtered = filterData(allData);
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                renderMobile(filtered);
                document.getElementById('schedule-table').style.display = 'none';
                document.getElementById('mobile-list').style.display = 'block';
            } else {
                renderTable(filtered);
                document.getElementById('schedule-table').style.display = 'table';
                document.getElementById('mobile-list').style.display = 'none';
            }
        }
    });

    // Первичная загрузка
    refresh();
});