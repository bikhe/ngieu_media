const year = 2024;
const month = 7; // August
const firstDay = new Date(year, month, 1);
let startDayOfWeek = firstDay.getDay();
startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
const daysInMonth = new Date(year, month + 1, 0).getDate();
const prevMonthDays = new Date(year, month, 0).getDate();
const dayCells = [];
for (let i = startDayOfWeek - 1; i >= 0; i--) {
  dayCells.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
}
for (let i = 1; i <= daysInMonth; i++) {
  dayCells.push({ date: new Date(year, month, i), isCurrentMonth: true });
}
const remainingCells = 42 - dayCells.length;
for (let i = 1; i <= remainingCells; i++) {
  dayCells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
}
console.log(dayCells.length);
