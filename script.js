// 🔹 Данные преподавателей и системных слотов
const teachers = [
  {name:'Маша', color:'#1e7c47'},
  {name:'Лиля', color:'#9c285e'},
  {name:'Настя', color:'#2448ad'},
  {name:'Влад', color:'#b4711f'},
  {name:'Катя', color:'#af2828'},
  {name:'Руди', color:'#6a2480'},
  {name:'Лиза', color:'#157177'}   
];

const systemMandatory = [
  { name: 'Свободное время', color: '#1098aa', editable: false },
  { name: 'Закрыто', color: '#222222', editable: false }
];

const occupiedColor = '#5f5f5fff';

const times = ['10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];

let scheduleHalls = {1:{},2:{}}; 
let weekDates = [];

// 🔹 Формат даты
function dateKey(d){
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // локальная дата
}


// 🔹 Следующие 30 дней
function getNext30Days(){
  const daysOfWeek = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const today = new Date();
  const dates = [];
  for(let i=0;i<30;i++){
    const d = new Date(today);
    d.setDate(today.getDate()+i);
    dates.push({
      date:d,
      dayName:daysOfWeek[d.getDay()],
      dayStr:`${d.getDate()}.${d.getMonth()+1}`,
      key:dateKey(d)
    });
  }
  return dates;
}

// 🔹 Пустое расписание
function initSchedule(){
  const sched={};
  times.forEach(time=>{
    sched[time]={};
    for(let i=0;i<30;i++) sched[time][i]={type:'free',teacher:null};
  });
  return sched;
}

// 🔹 Загрузка данных из Firebase
async function loadSchedules(){
  scheduleHalls[1]=initSchedule();
  scheduleHalls[2]=initSchedule();
  weekDates=getNext30Days();

  const occupiedSnap = await firebase.database().ref('calendar/occupied').get();
  const occupied = occupiedSnap.val() || {};

  // 🔹 Используем локальные mandatory из файла mandatory.js
  const mandatoryList = window.localMandatory || [];

// 🔹 Применяем occupied
[1,2].forEach(hall => {
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
  const dayMap={вс:0,пн:1,вт:2,ср:3,чт:4,пт:5,сб:6};
  mandatoryList.forEach(entry=>{
    const t=[...teachers,...systemMandatory].find(t=>t.name===entry.teacher);
    if(!t) return;
    entry.halls.forEach(hall=>{
      weekDates.forEach((dayObj,dayIndex)=>{
        const dow=dayObj.date.getDay();
        const ru=Object.keys(dayMap).find(k=>dayMap[k]===dow);
        if(entry.daysOfWeek.includes(ru)){
          entry.times.forEach(time=>{
            if(scheduleHalls[hall][time] && scheduleHalls[hall][time][dayIndex]){
              scheduleHalls[hall][time][dayIndex]={type:'mandatory',teacher:t};
            }
          });
        }
      });
    });
  });
}

// 🔹 Обновление ячейки в Firebase
async function updateCellInFirebase(hall, day, time, teacherName){
  const ref=firebase.database().ref(`calendar/occupied/${hall}`);
  const snap=await ref.get();
  let data=snap.val()||[];
  data=data.filter(item=>!(item.day===day && item.time===time));
  if(teacherName) data.push({day,time,teacher:teacherName});
  await ref.set(data);
}

// 🔹 Подписка на обновления Firebase
function initRealtimeUpdates(){
  firebase.database().ref('calendar/occupied').on('value', snapshot=>{
    const occupied=snapshot.val()||{};
    [1,2].forEach(hall=>{
      if(!scheduleHalls[hall]) return;
      Object.keys(scheduleHalls[hall]).forEach(time=>{
        for(let i=0;i<30;i++){
          if(scheduleHalls[hall][time][i].type==='occupied'){
            scheduleHalls[hall][time][i]={type:'free',teacher:null};
          }
        }
      });
      (occupied[hall]||[]).forEach(item=>{
        const dayIndex=weekDates.findIndex(d=>d.key===item.day);
        if(dayIndex>=0){
          const t=teachers.find(t=>t.name===item.teacher);
          if(t){
            scheduleHalls[hall][item.time][dayIndex]={type:'occupied',teacher:{...t,color:occupiedColor}};
          }
        }
      });
      renderHall(hall,'schedule-container-'+hall);
    });
  });
}















// 🔹 Клик по ячейке
async function onCellClick(td, hall, time, dayIndex) {
  const slot = scheduleHalls[hall][time][dayIndex];
  if (slot.type === 'mandatory') return;

  const existingPopup = document.getElementById('teacher-popup');
  if (existingPopup && existingPopup.dataset.cell === `${hall}-${time}-${dayIndex}`) {
    await closePopupSmooth(existingPopup); // плавное закрытие
    return;
  }
  if (existingPopup) await closePopupSmooth(existingPopup); // плавное закрытие перед открытием нового

  // 🔹 Удаление занятия
  if (slot.type === 'occupied') {
    if (confirm(`Удалить занятие "${slot.teacher.name}" на ${weekDates[dayIndex].dayStr} ${time} в зале ${hall}?`)) {
      scheduleHalls[hall][time][dayIndex] = { type: 'free', teacher: null };
      renderHall(hall, 'schedule-container-' + hall);
      await updateCellInFirebase(hall, weekDates[dayIndex].key, time, null);
    }
    return;
  }

  // 🔹 Создание popup
  const popup = document.createElement('div');
  popup.id = 'teacher-popup';
  popup.dataset.cell = `${hall}-${time}-${dayIndex}`;
  popup.style.position = 'absolute';
  popup.style.background = 'rgba(15, 30, 45, 0.96)';
  popup.style.backdropFilter = 'blur(6px)';
  popup.style.border = '1px solid rgba(255,255,255,0.08)';
  popup.style.borderRadius = '12px';
  popup.style.padding = '10px';
  popup.style.minWidth = '140px';
  popup.style.textAlign = 'center';
  popup.style.zIndex = 1000;
  popup.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
  popup.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  popup.style.opacity = '0';
  popup.style.transform = 'translateY(8px)';

  const rect = td.getBoundingClientRect();
  const popupWidth = 160;
  let left = rect.left + window.scrollX + rect.width / 2 - popupWidth / 2;
  const top = rect.bottom + window.scrollY + 8;

  const maxRight = window.scrollX + window.innerWidth - popupWidth - 8;
  if (left < 8) left = 8;
  if (left > maxRight) left = maxRight;

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;

  requestAnimationFrame(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translateY(0)';
  });

  // 🔹 Дата и время
  const info = document.createElement('div');
  info.innerHTML = `
    <div style="font-size:17px; margin-bottom:4px; color:#c9d1d9;">
      <strong>Дата:</strong> ${weekDates[dayIndex].dayStr}
    </div>
    <div style="font-size:17px; margin-bottom:8px; color:#c9d1d9;">
      <strong>Время:</strong> ${time}
    </div>
  `;
  popup.appendChild(info);

  // 🔹 Кнопки преподавателей
  teachers.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t.name;
    btn.style.display = 'block';
    btn.style.width = '100%';
    btn.style.margin = '3px 0';
    btn.style.padding = '7px 6px';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '16px';
    btn.style.transition = 'background 0.15s ease, color 0.15s ease';
    btn.style.background = t.color + '50';
    btn.onmouseover = () => (btn.style.background = t.color);
    btn.onmouseout = () => (btn.style.background = t.color + '22');

    btn.onclick = async () => {
      await closePopupSmooth(popup);
      scheduleHalls[hall][time][dayIndex] = { type: 'occupied', teacher: { ...t, color: occupiedColor } };
      renderHall(hall, 'schedule-container-' + hall);
      await updateCellInFirebase(hall, weekDates[dayIndex].key, time, t.name);
    };
    popup.appendChild(btn);
  });

  // 🔹 Кнопка "Отмена"
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Отмена';
  cancelBtn.style.display = 'block';
  cancelBtn.style.width = '100%';
  cancelBtn.style.marginTop = '8px';
  cancelBtn.style.padding = '7px';
  cancelBtn.style.border = 'none';
  cancelBtn.style.borderRadius = '6px';
  cancelBtn.style.color = '#bbb';
  cancelBtn.style.background = 'rgba(255,255,255,0.07)';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.style.fontSize = '13px';
  cancelBtn.style.transition = 'background 0.15s ease, color 0.15s ease';
  cancelBtn.onmouseover = () => {
    cancelBtn.style.background = 'rgba(255,255,255,0.12)';
    cancelBtn.style.color = '#fff';
  };
  cancelBtn.onmouseout = () => {
    cancelBtn.style.background = 'rgba(255,255,255,0.07)';
    cancelBtn.style.color = '#bbb';
  };
  cancelBtn.onclick = () => closePopupSmooth(popup);
  popup.appendChild(cancelBtn);

  document.body.appendChild(popup);

  // 🔹 Закрытие по клику вне popup
  const closePopup = (e) => {
    if (!popup.contains(e.target)) closePopupSmooth(popup);
  };
  setTimeout(() => document.addEventListener('click', closePopup), 10);
}

// 🔹 Плавное закрытие popup
async function closePopupSmooth(popup) {
  popup.style.opacity = '0';
  popup.style.transform = 'translateY(8px)';
  await new Promise(res => setTimeout(res, 200));
  popup.remove();
}






































// 🔹 Рендер расписания
function renderHall(hall,containerId){
  const sched=scheduleHalls[hall];
  const container=document.getElementById(containerId);
  if(!container) return;
  container.innerHTML='';

  const table=document.createElement('table');

  // Заголовки
  const weekHeader=document.createElement('tr');
  const dateTh=document.createElement('th');
  dateTh.textContent='Дата';
  dateTh.style.color='#39d3d6';
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
    th.style.color = '#39d3d6';

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

  const head=document.createElement('tr');
  const timeTh=document.createElement('th');
  timeTh.textContent='Время';
  timeTh.style.color='#39d3d6';
  head.appendChild(timeTh);

  weekDates.forEach(d=>{
    const th=document.createElement('th');
    th.innerHTML=`${d.dayName}<br><small>${d.dayStr}</small>`;
    th.style.color='#39d3d6';
    head.appendChild(th);
  });
  table.appendChild(head);

  times.forEach(time=>{
    const tr=document.createElement('tr');
    const tdTime=document.createElement('td');
    tdTime.textContent=time;
    tdTime.style.color='#39d3d6';
    tr.appendChild(tdTime);
    weekDates.forEach((d,i)=>{
      const td=document.createElement('td');
      const slot=sched[time][i];
      td.style.cursor='pointer';
      if(slot.type==='free'){
        td.title='Свободно';
        td.onclick=()=>onCellClick(td,hall,time,i);
      }else{
        td.textContent=slot.teacher.name;
        td.style.backgroundColor=slot.teacher.color;
        td.title=slot.type==='mandatory' ? slot.teacher.name : `Занято: ${slot.teacher.name}`;
        td.onclick=()=>onCellClick(td,hall,time,i);
      }
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  container.appendChild(table);
}

// 🔹 Инициализация
async function initAll(){
  await loadSchedules();
  initRealtimeUpdates();
  [1,2].forEach(hall=>renderHall(hall,'schedule-container-'+hall));
}

// 🔹 Запуск
document.addEventListener('DOMContentLoaded',initAll);
