import { db, ref, set, get, onValue, update } from "./firebase-config.js";

console.log("Firebase подключен:", db);

const teachers = [
  {name:'Маша', color:'#459227'},
  {name:'Лиля', color:'#a03169'},
  {name:'Настя', color:'#247cf7'},
  {name:'Влад', color:'#b6681f'},
  {name:'Катя', color:'#b43522'},
  {name:'Руди', color:'#583ea7'},
  {name:'Лиза', color:'#166e6e'}
];

const systemMandatory = [
  { name: 'Свободное время', color: '#4abdc5', editable: false },
  { name: 'Закрыто', color: '#222222ff', editable: false }
];

const occupiedColor = '#969696ff';
const times = [
  '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00'
];

let scheduleHalls = {1:{},2:{}}; 
let weekDates = [];

function dateKey(d){ return d.toISOString().split('T')[0]; }

function getNext30Days(){
  const daysOfWeek = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const today = new Date();
  const dates = [];
  for(let i=0; i<30; i++){
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push({
      date: d,
      dayName: daysOfWeek[d.getDay()],
      dayStr: `${d.getDate()}.${d.getMonth()+1}`,
      key: dateKey(d)
    });
  }
  return dates;
}

function initSchedule(){
  const sched = {};
  times.forEach(time=>{
    sched[time] = {};
    for(let i=0; i<30; i++){
      sched[time][i] = { type:'free', teacher:null };
    }
  });
  return sched;
}

async function loadSchedulesFromFirebase(){
  scheduleHalls[1] = initSchedule();
  scheduleHalls[2] = initSchedule();
  weekDates = getNext30Days();

  const snapshot = await get(ref(db, "schedules"));
  if (snapshot.exists()) {
    const data = snapshot.val();
    [1,2].forEach(hall => {
      if(data[hall]) {
        for(const day in data[hall]) {
          for(const time in data[hall][day]) {
            const teacherName = data[hall][day][time];
            if (teacherName) {
              const t = teachers.find(t => t.name === teacherName);
              const dayIndex = weekDates.findIndex(d => d.key === day);
              if (dayIndex >= 0 && t)
                scheduleHalls[hall][time][dayIndex] = { type:'occupied', teacher:{...t, color:occupiedColor} };
            }
          }
        }
      }
    });
  }
}

function saveToFirebase(hall, dayKey, time, teacherName){
  const path = `schedules/${hall}/${dayKey}/${time}`;
  update(ref(db), { [path]: teacherName });
}

function onCellClick(td, hall, time, dayIndex) {
  const slot = scheduleHalls[hall][time][dayIndex];
  const dayKey = weekDates[dayIndex].key;

  if (slot.type === 'mandatory') return;

  if (slot.type === 'occupied') {
    if (confirm(`Удалить занятие "${slot.teacher.name}" на ${weekDates[dayIndex].dayStr} ${time} в зале ${hall}?`)) {
      scheduleHalls[hall][time][dayIndex] = { type: 'free', teacher: null };
      renderHall(hall, 'schedule-container-' + hall);
      saveToFirebase(hall, dayKey, time, null);
    }
    return;
  }

  const existingPopup = document.getElementById('teacher-popup');
  if (existingPopup) existingPopup.remove();

  const popup = document.createElement('div');
  popup.id = 'teacher-popup';
  popup.style.position = 'absolute';
  popup.style.background = '#0b2030';
  popup.style.border = '1px solid #ccc';
  popup.style.borderRadius = '8px';
  popup.style.padding = '8px';
  popup.style.zIndex = 1000;

  const rect = td.getBoundingClientRect();
  popup.style.left = rect.left + window.scrollX + 'px';
  popup.style.top = rect.bottom + window.scrollY + 'px';

  const title = document.createElement('div');
  title.textContent = 'Выбери имя:';
  title.style.marginBottom = '6px';
  title.style.fontSize = '14px';
  popup.appendChild(title);

  teachers.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t.name;
    btn.style.display = 'block';
    btn.style.margin = '2px 0';
    btn.style.padding = '6px 20px';
    btn.style.border = 'none';
    btn.style.color = '#fff';
    btn.style.background = t.color + '33';
    btn.onmouseover = () => btn.style.background = t.color;
    btn.onmouseout = () => btn.style.background = t.color + '33';

    btn.onclick = () => {
      scheduleHalls[hall][time][dayIndex] = { type:'occupied', teacher:{...t, color:occupiedColor} };
      document.body.removeChild(popup);
      renderHall(hall, 'schedule-container-' + hall);
      saveToFirebase(hall, dayKey, time, t.name);
    };
    popup.appendChild(btn);
  });

  document.body.appendChild(popup);
  const closePopup = (e) => {
    if (!popup.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closePopup);
    }
  };
  setTimeout(() => document.addEventListener('click', closePopup), 10);
}

function renderHall(hall, containerId) {
  const sched = scheduleHalls[hall];
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const table = document.createElement('table');

  const head = document.createElement('tr');
  const th = document.createElement('th');
  th.textContent = 'Время';
  head.appendChild(th);
  weekDates.forEach(d => {
    const th2 = document.createElement('th');
    th2.innerHTML = `${d.dayName}<br>${d.dayStr}`;
    head.appendChild(th2);
  });
  table.appendChild(head);

  times.forEach(time => {
    const tr = document.createElement('tr');
    const tdTime = document.createElement('td');
    tdTime.textContent = time;
    tr.appendChild(tdTime);
    weekDates.forEach((d, i) => {
      const td = document.createElement('td');
      const slot = sched[time][i];
      if (slot.type === 'free') {
        td.className = 'free';
        td.onclick = () => onCellClick(td, hall, time, i);
      } else {
        td.className = 'occupied';
        td.textContent = slot.teacher.name;
        td.style.background = slot.teacher.color;
        td.onclick = () => onCellClick(td, hall, time, i);
      }
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  container.appendChild(table);
}

async function initAll(){
  await loadSchedulesFromFirebase();
  [1,2].forEach(hall => renderHall(hall, 'schedule-container-' + hall));

  // 🔹 Реальное обновление через Firebase (онлайн)
  onValue(ref(db, "schedules"), snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      [1,2].forEach(hall => {
        for(const day in data[hall]||{}){
          for(const time in data[hall][day]){
            const teacherName = data[hall][day][time];
            const dayIndex = weekDates.findIndex(d => d.key === day);
            if (dayIndex >= 0){
              if (teacherName){
                const t = teachers.find(t=>t.name === teacherName);
                scheduleHalls[hall][time][dayIndex] = {type:'occupied', teacher:{...t, color:occupiedColor}};
              } else {
                scheduleHalls[hall][time][dayIndex] = {type:'free', teacher:null};
              }
            }
          }
        }
      });
      [1,2].forEach(hall => renderHall(hall, 'schedule-container-' + hall));
    }
  });
}

document.addEventListener('DOMContentLoaded', initAll);
