// 🔹 Данные преподавателей и системных слотов
const teachers = [
    { name: 'Маша', color: '#2fa863' },
    { name: 'Лиля', color: '#df5696' },
    { name: 'Настя', color: '#4856d1' },
    { name: 'Влад', color: '#d68f38' },
    { name: 'Катя', color: '#f14e4e' },
    { name: 'Руди', color: '#9e4ab8' },
    { name: 'Лиза', color: '#3f989e' }
];

const systemMandatory = [
    { name: 'Свободное время', color: '#2cafc0', editable: false },
    { name: 'Закрыто', color: '#222222', editable: false }
];

const occupiedColor = '#444444';

const times = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];

let scheduleHalls = { 1: {}, 2: {} };
let weekDates = [];

// 🔹 Формат даты
function dateKey(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // локальная дата
}


// 🔹 Следующие 30 дней
function getNext30Days() {
    const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push({
            date: d,
            dayName: daysOfWeek[d.getDay()],
            dayStr: `${d.getDate()}.${d.getMonth() + 1}`,
            key: dateKey(d)
        });
    }
    return dates;
}

// 🔹 Пустое расписание
function initSchedule() {
    const sched = {};
    times.forEach(time => {
        sched[time] = {};
        for (let i = 0; i < 30; i++) sched[time][i] = { type: 'free', teacher: null };
    });
    return sched;
}

// 🔹 Загрузка данных из Firebase
async function loadSchedules() {
    scheduleHalls[1] = initSchedule();
    scheduleHalls[2] = initSchedule();
    weekDates = getNext30Days();

    const occupiedSnap = await firebase.database().ref('calendar/occupied').get();
    const occupied = occupiedSnap.val() || {};

    // 🔹 Используем локальные mandatory из файла mandatory.js
    const mandatoryList = window.localMandatory || [];

    // 🔹 Применяем occupied
    [1, 2].forEach(hall => {
        const hallOccupied = occupied[hall] || [];
        hallOccupied.forEach(item => {
            const dayIndex = weekDates.findIndex(d => d.key === item.day);
            if (dayIndex === -1) return;

            const t = teachers.find(t => t.name === item.teacher);
            if (!t) return;

            scheduleHalls[hall][item.time][dayIndex] = {
                type: 'occupied',
                teacher: { ...t, color: occupiedColor }
            };
        });
    });




    // Применяем mandatory
    const dayMap = { вс: 0, пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6 };
    mandatoryList.forEach(entry => {
        const t = [...teachers, ...systemMandatory].find(t => t.name === entry.teacher);
        if (!t) return;
        entry.halls.forEach(hall => {
            weekDates.forEach((dayObj, dayIndex) => {
                const dow = dayObj.date.getDay();
                const ru = Object.keys(dayMap).find(k => dayMap[k] === dow);
                if (entry.daysOfWeek.includes(ru)) {
                    entry.times.forEach(time => {
                        if (scheduleHalls[hall][time] && scheduleHalls[hall][time][dayIndex]) {
                            scheduleHalls[hall][time][dayIndex] = { type: 'mandatory', teacher: t };
                        }
                    });
                }
            });
        });
    });
}

// 🔹 Обновление ячейки в Firebase
async function updateCellInFirebase(hall, day, time, teacherName) {
    const ref = firebase.database().ref(`calendar/occupied/${hall}`);
    const snap = await ref.get();
    let data = snap.val() || [];
    data = data.filter(item => !(item.day === day && item.time === time));
    if (teacherName) data.push({ day, time, teacher: teacherName });
    await ref.set(data);
}

// 🔹 Подписка на обновления Firebase
function initRealtimeUpdates() {
    firebase.database().ref('calendar/occupied').on('value', snapshot => {
        const occupied = snapshot.val() || {};
        [1, 2].forEach(hall => {
            if (!scheduleHalls[hall]) return;
            Object.keys(scheduleHalls[hall]).forEach(time => {
                for (let i = 0; i < 30; i++) {
                    if (scheduleHalls[hall][time][i].type === 'occupied') {
                        scheduleHalls[hall][time][i] = { type: 'free', teacher: null };
                    }
                }
            });
            (occupied[hall] || []).forEach(item => {
                const dayIndex = weekDates.findIndex(d => d.key === item.day);
                if (dayIndex >= 0) {
                    const t = teachers.find(t => t.name === item.teacher);
                    if (t) {
                        scheduleHalls[hall][item.time][dayIndex] = { type: 'occupied', teacher: { ...t, color: occupiedColor } };
                    }
                }
            });
            renderHall(hall, 'schedule-container-' + hall);
        });
    });
}















// глобальные переменные (как у тебя выше)
let activeTd = null; // текущая подсвеченная ячейка
let closePopupHandler = null; // слушатель клика вне popup

// Полный onCellClick — заменяй им старый
async function onCellClick(td, hall, time, dayIndex) {
    const slot = scheduleHalls[hall][time][dayIndex];
    if (slot.type === 'mandatory') return;

    // Если popup уже открыт на той же ячейке → закрываем
    const existingPopup = document.getElementById('teacher-popup');
    if (existingPopup && existingPopup.dataset.cell === `${hall}-${time}-${dayIndex}`) {
        await closePopupSmooth(existingPopup);
        if (activeTd) activeTd.classList.remove('cell-active');
        activeTd = null;
        return;
    }

    // Если был открыт другой popup → закрыть перед открытием нового
    if (existingPopup) {
        await closePopupSmooth(existingPopup);
        if (activeTd) activeTd.classList.remove('cell-active');
        activeTd = null;
    }

    // Удаление занятия (если slot занят)
    if (slot.type === 'occupied') {
        if (confirm(`Удалить занятие "${slot.teacher.name}" на ${weekDates[dayIndex].dayStr} ${time} в зале ${hall}?`)) {
            scheduleHalls[hall][time][dayIndex] = { type: 'free', teacher: null };
            renderHall(hall, 'schedule-container-' + hall);
            await updateCellInFirebase(hall, weekDates[dayIndex].key, time, null);
        }
        return;
    }

    // Подсветка активной ячейки
    td.classList.add('cell-active');
    activeTd = td;

    // Создаём popup
    const popup = document.createElement('div');
    popup.id = 'teacher-popup';
    popup.dataset.cell = `${hall}-${time}-${dayIndex}`;
    popup.style.position = 'absolute';
    popup.style.background = '#fff';
    popup.style.borderRadius = '30px';
    popup.style.padding = '10px';
    popup.style.border = '1px solid #f2f0fa';
    popup.style.boxShadow = '0 6px 24px #0000000f';
    popup.style.minWidth = '160px';
    popup.style.textAlign = 'center';
    popup.style.zIndex = 1000;


    // Позиционируем popup
    const rect = td.getBoundingClientRect();
    const popupWidth = 160;
    let left = rect.left + window.scrollX + rect.width / 2 - popupWidth / 2;
    const top = rect.bottom + window.scrollY + 8;
    const maxRight = window.scrollX + window.innerWidth - popupWidth - 8;
    if (left < 8) left = 8;
    if (left > maxRight) left = maxRight;
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    // Содержимое (дата/время)
    const info = document.createElement('div');
    info.innerHTML = `
    <div style="font-size:17px; margin-bottom:4px; color:#9526c0;">
      <strong>Дата:</strong> ${weekDates[dayIndex].dayStr}
    </div>
    <div style="font-size:17px; margin-bottom:8px; color:#9526c0;">
      <strong>Время:</strong> ${time}
    </div>
  `;
    popup.appendChild(info);

    // Кнопки преподавателей
    teachers.forEach(t => {
        const btn = document.createElement('button');
        btn.textContent = t.name;
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.margin = '5px 0';
        btn.style.padding = '10px';
        btn.style.border = 'none';
        btn.style.fontWeight = '500';

        btn.style.borderRadius = '5vh';
        btn.style.color = '#fff';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '15px';
        btn.style.background = t.color + '99';
        btn.addEventListener('mouseover', () => {
            btn.style.background = t.color;
            btn.style.color = '#fff';
        });
        btn.addEventListener('mouseout', () => {
            btn.style.background = t.color + '99';
        });


        btn.onclick = async () => {
            if (activeTd) activeTd.classList.remove('cell-active');
            await closePopupSmooth(popup);
            scheduleHalls[hall][time][dayIndex] = { type: 'occupied', teacher: { ...t, color: occupiedColor } };
            renderHall(hall, 'schedule-container-' + hall);
            await updateCellInFirebase(hall, weekDates[dayIndex].key, time, t.name);
        };
        popup.appendChild(btn);
    });

    // Кнопка отмены
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Отмена';
    cancelBtn.style.display = 'block';
    cancelBtn.style.width = '100%';
    cancelBtn.style.marginTop = '8px';
    cancelBtn.style.padding = '7px';
    cancelBtn.style.border = '1px solid #f2f0fa';
    cancelBtn.style.borderRadius = '5vh';
    cancelBtn.style.color = '#5a205a';
    cancelBtn.style.background = '#f7fcfc';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontSize = '13px';
    cancelBtn.onmouseover = () => {
        cancelBtn.style.background = '#9526c0';
        cancelBtn.style.color = '#f7fcfc';
    };
    cancelBtn.onmouseout = () => {
        cancelBtn.style.background = '#f7fcfc';
        cancelBtn.style.color = '#5a205a';
    };
    cancelBtn.onclick = async () => {
        if (activeTd) activeTd.classList.remove('cell-active');
        activeTd = null;
        await closePopupSmooth(popup);
    };
    popup.appendChild(cancelBtn);

    // Начальное состояние перед анимацией — мгновенное вставление в DOM
    popup.style.opacity = '0';
    popup.style.transform = 'translateY(2px)';

    document.body.appendChild(popup);

    // Запуск плавного появления в следующем кадре — моментальный отклик
    requestAnimationFrame(() => {
        popup.style.opacity = '1';
        popup.style.transform = 'translateY(0)';
    });

    // Закрытие по клику вне popup — регистрируем обработчик
    if (closePopupHandler) document.removeEventListener('click', closePopupHandler);
    closePopupHandler = (e) => {
        if (!popup.contains(e.target)) {
            if (activeTd) activeTd.classList.remove('cell-active');
            activeTd = null;
            closePopupSmooth(popup);
            document.removeEventListener('click', closePopupHandler);
            closePopupHandler = null;
        }
    };
    // даём браузеру миллисекунду чтобы не поймать этот же клик
    setTimeout(() => document.addEventListener('click', closePopupHandler), 0);
}

// Плавное закрытие popup — принимает сам popup-элемент
async function closePopupSmooth(popup) {
    if (!popup) return;
    // если передали id или получили по DOM
    if (typeof popup === 'string') popup = document.getElementById(popup);
    if (!popup || popup.style.display === 'none') {
        // просто удалим, если он в DOM
        if (popup && popup.parentNode) popup.remove();
        return;
    }

    // Убираем визуально
    popup.style.transition = 'opacity 0.08s ease-out, transform 0.08s ease-out';
    popup.style.opacity = '0';
    popup.style.transform = 'translateY(2px)';

    // Снимаем подсветку активной ячейки
    if (activeTd) activeTd.classList.remove('cell-active');
    activeTd = null;

    // Ждём завершения анимации и удаляем
    await new Promise(res => setTimeout(res, 80));
    if (popup.parentNode) popup.remove();
}









































// 🔹 Рендер расписания
function renderHall(hall, containerId) {
    const sched = scheduleHalls[hall];
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const table = document.createElement('table');

    // Заголовки
    const weekHeader = document.createElement('tr');
    const dateTh = document.createElement('th');
    dateTh.textContent = 'Дата';
    dateTh.style.color = '#9526c0';
    dateTh.style.background = '#f2f0fa';
    dateTh.style.borderWidth = '0px 1px 1px 0px';
    dateTh.style.borderStyle = 'solid';
    dateTh.style.borderColor = '#9526c0';
    weekHeader.appendChild(dateTh);

    let start = 0;
    while (start < weekDates.length) {
        const startDay = weekDates[start].date;
        const startDow = startDay.getDay();
        const daysLeftInWeek = (7 - ((startDow + 6) % 7 + 1));
        const end = Math.min(start + daysLeftInWeek + 1, weekDates.length);

        const startDate = weekDates[start].dayStr;
        const endDate = weekDates[end - 1].dayStr;

        const th = document.createElement('th');
        th.colSpan = end - start;
        th.style.color = '#9526c0';
        th.style.borderWidth = '0px 0px 1px 1px';
        th.style.borderStyle = 'solid';
        th.style.borderColor = '#9526c0';

        // ✅ если неделя из одного дня — просто дата, иначе "с ... по ..."
        if (startDate === endDate) {
            th.textContent = startDate;
        } else {
            th.textContent = `с ${startDate} по ${endDate}`;
        }

        weekHeader.appendChild(th);
        start = end;
    }

    table.appendChild(weekHeader);

    const head = document.createElement('tr');
    const timeTh = document.createElement('th');
    timeTh.textContent = 'Время';
    timeTh.style.color = '#9526c0';
    timeTh.style.background = '#f2f0fa';
    timeTh.style.borderWidth = '1px 1px 1px 0px';
    timeTh.style.borderStyle = 'solid';
    timeTh.style.borderColor = '#9526c0';
    head.appendChild(timeTh);

    weekDates.forEach(d => {
        const th = document.createElement('th');
        th.innerHTML = `${d.dayName}<br><small>${d.dayStr}</small>`;
        th.style.color = '#9526c0';
        th.style.background = '#f2f0fa';
        th.style.borderWidth = '1px 0px 1px 1px';
        th.style.borderStyle = 'solid';
        th.style.borderColor = '#9526c0';
        head.appendChild(th);
    });
    table.appendChild(head);

    times.forEach(time => {
        const tr = document.createElement('tr');
        const tdTime = document.createElement('td');
        tdTime.textContent = time;
        tdTime.style.color = '#9526c0';
        tdTime.style.background = '#f2f0fa';
        tdTime.style.textAlign = 'center';
        tr.appendChild(tdTime);
        weekDates.forEach((d, i) => {
            const td = document.createElement('td');
            const slot = sched[time][i];

            // Сбрасываем/назначаем классы и курсор в зависимости от типа
            td.classList.remove('free', 'occupied', 'mandatory');

            if (slot.type === 'free') {
                td.classList.add('free');
                td.title = 'Свободно';
                td.style.cursor = 'pointer';
                td.onclick = () => onCellClick(td, hall, time, i);
            } else if (slot.type === 'occupied') {
                td.classList.add('occupied');
                td.textContent = slot.teacher.name;
                td.style.backgroundColor = slot.teacher.color;
                td.title = `Занято: ${slot.teacher.name}`;
                td.style.cursor = 'pointer';
                td.onclick = () => onCellClick(td, hall, time, i);
            } else if (slot.type === 'mandatory') {
                td.classList.add('mandatory');
                td.textContent = slot.teacher.name;
                td.style.backgroundColor = slot.teacher.color;
                td.title = slot.teacher.name;
                // Тут явно ставим курсор текстом
                td.style.cursor = 'text';
                // Не вешаем onclick — уже обработано в onCellClick (оно сразу возвращает), 
                // но если нужно, можно всё равно повесить
                td.onclick = () => onCellClick(td, hall, time, i);
            }

            tr.appendChild(td);

        });
        table.appendChild(tr);
    });

    container.appendChild(table);
}

// 🔹 Инициализация
async function initAll() {
    await loadSchedules();
    initRealtimeUpdates();
    [1, 2].forEach(hall => renderHall(hall, 'schedule-container-' + hall));
}

// 🔹 Запуск
document.addEventListener('DOMContentLoaded', initAll);
