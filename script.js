// 🔹 Данные преподавателей и системных слотов
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
const times = ['10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];

let scheduleHalls = {1:{},2:{}}; 
let weekDates = [];

// 🔹 Формат даты
function dateKey(d){ return d.toISOString().split('T')[0]; }

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


   // Применяем occupied — теперь строго по дате (надёжно)
[1, 2].forEach(hall => {
  (occupied[hall] || []).forEach(item => {
    const itemDate = new Date(item.day);
    if (isNaN(itemDate)) {
      console.warn('❗ Неверная дата в occupied:', item.day);
      return;
    }

    // Берём первый день текущего окна (пн)
    const windowStartDate = new Date(weekDates[0].date);
    const msPerDay = 24 * 60 * 60 * 1000;

    // Сравниваем только даты без учёта времени
    const itemMidnight = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    const windowStartMidnight = new Date(windowStartDate.getFullYear(), windowStartDate.getMonth(), windowStartDate.getDate());

    // Разница в днях между началом недели и нужной датой
    const dayIndex = Math.round((itemMidnight - windowStartMidnight) / msPerDay);

    if (dayIndex >= 0 && dayIndex < weekDates.length) {
      const t = teachers.find(t => t.name === item.teacher);
      if (t) {
        scheduleHalls[hall][item.time][dayIndex] = { type: 'occupied', teacher: { ...t, color: occupiedColor } };
      } else {
        scheduleHalls[hall][item.time][dayIndex] = { type: 'occupied', teacher: { name: item.teacher, color: occupiedColor } };
      }
    }
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
            (occupied[hall] || []).forEach(item => {
  const itemDate = new Date(item.day);
  if (isNaN(itemDate)) {
    console.warn('❗ Неверная дата в occupied:', item.day);
    return;
  }

  // Первый день текущего окна (понедельник)
  const windowStartDate = new Date(weekDates[0].date);
  const msPerDay = 24 * 60 * 60 * 1000;

  // Сравниваем только даты, без времени и таймзоны
  const itemMidnight = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
  const windowStartMidnight = new Date(windowStartDate.getFullYear(), windowStartDate.getMonth(), windowStartDate.getDate());

  // Разница в днях между датой элемента и началом недели
  const dayIndex = Math.round((itemMidnight - windowStartMidnight) / msPerDay);

  if (dayIndex >= 0 && dayIndex < weekDates.length) {
    const t = teachers.find(t => t.name === item.teacher);
    if (t) {
      scheduleHalls[hall][item.time][dayIndex] = {
        type: 'occupied',
        teacher: { ...t, color: occupiedColor }
      };
    } else {
      scheduleHalls[hall][item.time][dayIndex] = {
        type: 'occupied',
        teacher: { name: item.teacher, color: occupiedColor }
      };
    }
  }
});


      renderHall(hall,'schedule-container-'+hall);
    });
  });
}

// 🔹 Клик по ячейке
async function onCellClick(td,hall,time,dayIndex){
  const slot=scheduleHalls[hall][time][dayIndex];
  if(slot.type==='mandatory') return;

  const existingPopup=document.getElementById('teacher-popup');
  if(existingPopup) existingPopup.remove();

  // Удаление занятия
  if(slot.type==='occupied'){
    if(confirm(`Удалить занятие "${slot.teacher.name}" на ${weekDates[dayIndex].dayStr} ${time} в зале ${hall}?`)){
      scheduleHalls[hall][time][dayIndex]={type:'free',teacher:null};
      renderHall(hall,'schedule-container-'+hall);
      await updateCellInFirebase(hall,weekDates[dayIndex].key,time,null);
    }
    return;
  }

  // Popup выбора преподавателя
  const popup=document.createElement('div');
  popup.id='teacher-popup';
  popup.style.position='absolute';
  popup.style.color='#fff';
  popup.style.background='#0b2030';
  popup.style.border='1px solid #ccc';
  popup.style.borderRadius='8px';
  popup.style.padding='8px';
  popup.style.minWidth='100px';
  popup.style.zIndex=1000;

  const rect=td.getBoundingClientRect();
  popup.style.left=rect.left+window.scrollX+'px';
  popup.style.top=rect.bottom+window.scrollY+'px';

  const title=document.createElement('div');
  title.textContent='Выбери имя:';
  title.style.marginBottom='6px';
  title.style.fontWeight='600';
  popup.appendChild(title);

  teachers.forEach(t=>{
    const btn=document.createElement('button');
    btn.textContent=t.name;
    btn.style.display='block';
    btn.style.width='100%';
    btn.style.margin='2px 0';
    btn.style.padding='6px';
    btn.style.border='none';
    btn.style.borderRadius='4px';
    btn.style.color='#fff';
    btn.style.cursor='pointer';
    btn.style.background=t.color+'33';
    btn.onmouseover=()=>btn.style.background=t.color;
    btn.onmouseout=()=>btn.style.background=t.color+'33';
    btn.onclick=async()=>{
      scheduleHalls[hall][time][dayIndex]={type:'occupied',teacher:{...t,color:occupiedColor}};
      document.body.removeChild(popup);
      renderHall(hall,'schedule-container-'+hall);
      await updateCellInFirebase(hall,weekDates[dayIndex].key,time,t.name);
    };
    popup.appendChild(btn);
  });

  document.body.appendChild(popup);
  const closePopup=(e)=>{
    if(!popup.contains(e.target)){
      popup.remove();
      document.removeEventListener('click',closePopup);
    }
  };
  setTimeout(()=>document.addEventListener('click',closePopup),10);
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

  let start=0;
  while(start<weekDates.length){
    const startDay=weekDates[start].date;
    const startDow=startDay.getDay();
    const daysLeftInWeek=(7-((startDow+6)%7+1));
    const end=Math.min(start+daysLeftInWeek+1,weekDates.length);
    const startDate=weekDates[start].dayStr;
    const endDate=weekDates[end-1].dayStr;
    const th=document.createElement('th');
    th.colSpan=end-start;
    th.textContent=`с ${startDate} по ${endDate}`;
    th.style.color='#39d3d6';
    weekHeader.appendChild(th);
    start=end;
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
  showUpdateNotice(); // 🔹 показать время загрузки при старте
}


// 🔹 Запуск
document.addEventListener('DOMContentLoaded',initAll);











// 🔹 Обновление расписания полностью
async function reloadAll() {
  console.log("♻️ Перезагрузка расписания (новый день)");
  scheduleHalls = {1:{}, 2:{}}; 
  weekDates = getNext30Days();  
  await loadSchedules();        
  [1, 2].forEach(hall => renderHall(hall, 'schedule-container-' + hall));
  showUpdateNotice(); // 🔹 обновляем дату в панели
}



// 🔹 Проверка смены дня — чтобы расписание обновлялось автоматически
let currentDateKey = dateKey(new Date()); // теперь текущая дата при старте

setInterval(async () => {
  const todayKey = dateKey(new Date());
  if (todayKey !== currentDateKey) {
    console.log(`📅 День сменился: ${currentDateKey} → ${todayKey}`);
    currentDateKey = todayKey;
    await reloadAll(); // перерисовываем всё, включая occupied
  }
}, 60 * 1000); // проверяем каждые 60 секунд








function showUpdateNotice() {
  const div = document.getElementById('update-notice');
  if (!div) return;
  
  const now = new Date();
  const formatted = now.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  div.textContent = `🟢 Последнее обновление: ${formatted}`;
}

