const DAYS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
const DAY_SHORT = ["一", "二", "三", "四", "五", "六", "日"];
const PERIOD_TIMES = [
  ["08:00", "08:45"], ["08:55", "09:40"], ["10:00", "10:45"], ["10:55", "11:40"],
  ["14:00", "14:45"], ["14:55", "15:40"], ["16:00", "16:45"], ["16:55", "17:40"],
  ["18:30", "19:15"], ["19:25", "20:10"], ["20:20", "21:05"], ["21:15", "22:00"],
];
const SESSION_NAMES = { 1: "上午", 5: "下午", 9: "晚上" };
const WEEK_MAX = 18;

const SAMPLE_COURSES = [
  { day: 1, periodStart: 1, periodEnd: 1, name: "爆破工程", teacher: "谢全民", room: "J33B106", ranges: [[16, 18]] },
  { day: 2, periodStart: 1, periodEnd: 1, name: "人工智能原理与应用", teacher: "朱婷", room: "J32A205", ranges: [[2, 4], [9, 12]] },
  { day: 4, periodStart: 1, periodEnd: 1, name: "人工智能原理与应用", teacher: "朱婷", room: "J32A207", ranges: [[2, 3], [5, 5], [9, 10]] },
  { day: 5, periodStart: 3, periodEnd: 3, name: "工程伦理", teacher: "李素兰 / 涂圣武", room: "J32A103", ranges: [[2, 11]] },
  { day: 1, periodStart: 5, periodEnd: 5, name: "高等工程数学", teacher: "戚啸", room: "J01A212", ranges: [[14, 15]] },
  { day: 2, periodStart: 5, periodEnd: 5, name: "高等工程数学", teacher: "戚啸", room: "J01A201", ranges: [[2, 4], [6, 16]] },
  { day: 3, periodStart: 5, periodEnd: 5, name: "研究生英语（一）", teacher: "刘希", room: "J03B103", ranges: [[1, 4], [6, 17]] },
  { day: 4, periodStart: 5, periodEnd: 5, name: "爆破工程", teacher: "夏宇璨", room: "J33A204", ranges: [[2, 3], [5, 8], [11, 12]] },
  { day: 6, periodStart: 5, periodEnd: 5, name: "新时代中国特色社会主义理论与实践", teacher: "胡慧", room: "线上", ranges: [[1, 2], [5, 11]], online: true },
  { day: 3, periodStart: 7, periodEnd: 7, name: "高等土力学", teacher: "张震", room: "J32A102", ranges: [[2, 4], [6, 18]] },
  { day: 1, periodStart: 9, periodEnd: 9, name: "爆破工程", teacher: "谢全民", room: "J33B106", ranges: [[14, 18]] },
  { day: 4, periodStart: 9, periodEnd: 9, name: "科学计算和数据科学应用", teacher: "桑鸿乾", room: "J33B104", ranges: [[17, 18]] },
  { day: 5, periodStart: 9, periodEnd: 9, name: "科学计算和数据科学应用", teacher: "桑鸿乾", room: "J33B104", ranges: [[18, 18]] },
  { day: 6, periodStart: 9, periodEnd: 9, name: "科学计算和数据科学应用", teacher: "桑鸿乾", room: "J33B104", ranges: [[2, 16]] },
  { day: 7, periodStart: 11, periodEnd: 11, name: "心理健康教育", teacher: "网络授课", room: "线上课程", ranges: [[2, 10]], online: true },
];

let courses = structuredClone(SAMPLE_COURSES);
let selectedWeek = "all";
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const scheduleGrid = $("#scheduleGrid");
const courseList = $("#courseList");
const weekFilter = $("#weekFilter");
const importDialog = $("#importDialog");
const fileInput = $("#fileInput");
const dropZone = $("#dropZone");
const pasteInput = $("#pasteInput");
const importStatus = $("#importStatus");

function cleanText(value) {
  return String(value ?? "")
    .replace(/[\u0000\u0003\u0004\u0007]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[,，;；\s]+|[,，;；\s]+$/g, "")
    .trim();
}

function parseDay(value) {
  const text = String(value ?? "").trim().toLowerCase();
  const english = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
  if (english[text]) return english[text];
  const match = text.match(/[1-7]/);
  if (match && !text.includes("202")) return Number(match[0]);
  const chinese = ["一", "二", "三", "四", "五", "六", "日", "天"];
  const index = chinese.findIndex((char) => text.includes(char));
  return index >= 0 ? Math.min(index + 1, 7) : 1;
}

function parseRanges(value, fallbackStart = 1, fallbackEnd = WEEK_MAX) {
  if (Array.isArray(value)) {
    const normalized = value.map((range) => Array.isArray(range) ? range : [range.start, range.end]).map(([start, end]) => [Number(start), Number(end ?? start)]).filter(([start]) => Number.isFinite(start));
    if (normalized.length) return normalized.map(([start, end]) => [Math.max(1, start), Math.min(WEEK_MAX, Math.max(start, end))]);
  }
  const matches = String(value ?? "").match(/\d+\s*(?:-|—|~|至)\s*\d+|\d+/g) || [];
  const ranges = [];
  matches.forEach((item) => {
    const numbers = item.match(/\d+/g).map(Number);
    const start = numbers[0];
    const end = numbers[1] ?? start;
    if (Number.isFinite(start)) ranges.push([Math.max(1, start), Math.min(WEEK_MAX, Math.max(start, end))]);
  });
  return ranges.length ? ranges : [[fallbackStart, fallbackEnd]];
}

function weeksLabel(ranges) {
  return ranges.map(([start, end]) => start === end ? `${start}` : `${start}–${end}`).join(", ") + "周";
}

function isCourseActive(course, week) {
  if (week === "all") return true;
  return course.ranges.some(([start, end]) => Number(week) >= start && Number(week) <= end);
}

function normalizeCourse(raw) {
  const day = Math.max(1, Math.min(7, Number(raw.day ?? parseDay(raw.weekday ?? raw.week ?? raw.dayOfWeek)) || 1));
  const periodValue = raw.period ?? raw.startPeriod ?? raw.section ?? 1;
  const periodMatches = String(periodValue).match(/\d+/g)?.map(Number) || [1];
  const periodStart = Math.max(1, Math.min(12, Number(raw.periodStart ?? raw.start ?? periodMatches[0]) || 1));
  const periodEnd = Math.max(periodStart, Math.min(12, Number(raw.periodEnd ?? raw.end ?? periodMatches[1] ?? periodStart) || periodStart));
  const name = cleanText(raw.name ?? raw.course ?? raw.courseName ?? "未命名课程") || "未命名课程";
  const teacher = cleanText(raw.teacher ?? raw.instructor ?? "未填写教师") || "未填写教师";
  const room = cleanText(raw.room ?? raw.location ?? "未填写教室") || "未填写教室";
  const ranges = parseRanges(raw.ranges ?? raw.weeks ?? raw.weekRange, Number(raw.weekStart) || 1, Number(raw.weekEnd) || WEEK_MAX);
  return { day, periodStart, periodEnd, name, teacher, room, ranges, online: Boolean(raw.online || /线上|网络/.test(room + teacher)) };
}

function visibleCourses() {
  return courses.filter((course) => isCourseActive(course, selectedWeek));
}

function courseKey(course) {
  return `${course.day}-${course.periodStart}`;
}

function renderWeekOptions() {
  weekFilter.innerHTML = '<option value="all">全部周次</option>';
  for (let week = 1; week <= WEEK_MAX; week += 1) {
    const option = document.createElement("option");
    option.value = String(week);
    option.textContent = `第 ${week} 周`;
    weekFilter.append(option);
  }
  weekFilter.value = selectedWeek;
}

function renderGrid() {
  const active = visibleCourses();
  const byCell = new Map();
  active.forEach((course) => {
    const key = courseKey(course);
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(course);
  });

  scheduleGrid.innerHTML = "";
  const corner = document.createElement("div");
  corner.className = "grid-corner";
  scheduleGrid.append(corner);
  DAYS.forEach((day, index) => {
    const header = document.createElement("div");
    header.className = "day-header";
    header.innerHTML = `<span>${day}</span><strong>${DAY_SHORT[index]}</strong>`;
    scheduleGrid.append(header);
  });

  for (let period = 1; period <= 12; period += 1) {
    const timeCell = document.createElement("div");
    timeCell.className = "time-cell";
    const [start, end] = PERIOD_TIMES[period - 1];
    timeCell.innerHTML = `${SESSION_NAMES[period] ? `<span class="session-label">${SESSION_NAMES[period]}</span>` : ""}<strong>${period}</strong><span>${start}</span><span>${end}</span>`;
    scheduleGrid.append(timeCell);

    for (let day = 1; day <= 7; day += 1) {
      const cell = document.createElement("div");
      cell.className = "day-cell";
      const cellCourses = byCell.get(`${day}-${period}`) || [];
      if (!cellCourses.length) {
        cell.innerHTML = '<div class="empty-cell" aria-hidden="true"></div>';
      } else {
        cellCourses.forEach((course) => cell.append(createCourseCard(course)));
      }
      scheduleGrid.append(cell);
    }
  }
  $("#courseCount").textContent = String(active.length);
  $("#activeWeekLabel").textContent = selectedWeek === "all" ? "全部" : `第${selectedWeek}周`;
}

function createCourseCard(course) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `course-card${course.online ? " online" : ""}`;
  card.title = `${course.name} · 点击查看详情`;
  card.innerHTML = `<h3>${escapeHtml(course.name)}</h3><p>${escapeHtml(course.teacher)}</p><p>${escapeHtml(course.room)}</p><span class="weeks-chip">${weeksLabel(course.ranges)}</span>`;
  card.addEventListener("click", () => showCourseDetail(course));
  return card;
}

function renderCourseList() {
  const active = visibleCourses();
  courseList.innerHTML = "";
  $("#listHint").textContent = selectedWeek === "all" ? "按课程查看周次" : `第 ${selectedWeek} 周正在上课`;
  if (!active.length) {
    courseList.innerHTML = '<div class="empty-list">这一周没有课程，可以切换周次或导入新课表。</div>';
    return;
  }
  active.forEach((course) => {
    const row = document.createElement("div");
    row.className = "course-row";
    row.innerHTML = `<div class="course-day">${DAYS[course.day - 1]} · ${course.periodStart}${course.periodEnd !== course.periodStart ? `–${course.periodEnd}` : ""} 节</div><div class="course-row-main"><strong>${escapeHtml(course.name)}</strong><span>${escapeHtml(course.teacher)} · ${escapeHtml(course.room)}</span></div><div class="course-week">${weeksLabel(course.ranges)}</div>`;
    row.addEventListener("click", () => showCourseDetail(course));
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") showCourseDetail(course); });
    courseList.append(row);
  });
}

function render() {
  renderGrid();
  renderCourseList();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function showCourseDetail(course) {
  $("#detailContent").innerHTML = `<h2 id="detail-title">${escapeHtml(course.name)}</h2><div class="detail-grid"><div class="detail-line"><span>时间</span><strong>${DAYS[course.day - 1]} · 第 ${course.periodStart}${course.periodEnd !== course.periodStart ? `–${course.periodEnd}` : ""} 节</strong></div><div class="detail-line"><span>教师</span><strong>${escapeHtml(course.teacher)}</strong></div><div class="detail-line"><span>地点</span><strong>${escapeHtml(course.room)}</strong></div><div class="detail-line"><span>周次</span><strong>${weeksLabel(course.ranges)}</strong></div></div>`;
  $("#detailDialog").showModal();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((item) => item !== "")) rows.push(row);
      row = []; cell = ""; continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((item) => item !== "")) rows.push(row);
  return rows;
}

function parseCSVText(text) {
  const rows = parseCSV(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.toLowerCase().replace(/[\s_-]/g, ""));
  const findIndex = (names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const indexes = {
    name: findIndex(["课程名称", "课程", "course", "name"]),
    day: findIndex(["星期", "周几", "day"]),
    period: findIndex(["节次", "period", "section"]),
    start: findIndex(["开始节", "start"]),
    end: findIndex(["结束节", "end"]),
    teacher: findIndex(["教师", "老师", "teacher", "instructor"]),
    room: findIndex(["教室", "地点", "room", "location"]),
    weeks: findIndex(["周次", "weeks", "week"]),
  };
  return rows.slice(1).map((row) => normalizeCourse({
    name: row[indexes.name], day: row[indexes.day], period: row[indexes.period], start: row[indexes.start], end: row[indexes.end], teacher: row[indexes.teacher], room: row[indexes.room], weeks: row[indexes.weeks],
  })).filter((course) => course.name !== "未命名课程");
}

function parseJSONText(text) {
  const value = JSON.parse(text);
  const list = Array.isArray(value) ? value : value.courses ?? value.items ?? [];
  return list.map(normalizeCourse).filter(Boolean);
}

const COURSE_PATTERN = /([^\[\]\r\n\u0007]{1,80})\[(\d+)\s*-\s*(\d+)\s*周\]([^\[\]\r\n\u0007]{0,30})\[([^\[\]\r\n\u0007]{0,30})\]/g;

function extractCellCourses(cell, day, period) {
  const found = [];
  for (const match of cell.matchAll(COURSE_PATTERN)) {
    const name = cleanText(match[1]);
    const teacher = cleanText(match[4]) || "未填写教师";
    const room = cleanText(match[5]) || "未填写教室";
    if (!name || /^(节次|星期|上午|下午|晚上)$/.test(name)) continue;
    found.push(normalizeCourse({ name, day, period, teacher, room, ranges: [[Number(match[2]), Number(match[3])]] }));
  }
  return found;
}

function parseLegacyDocText(text) {
  const clean = text.replace(/\u0000/g, "");
  const headerIndex = clean.indexOf("星期一");
  const tableStart = clean.lastIndexOf("第一学期", headerIndex >= 0 ? headerIndex : clean.length);
  const tableText = clean.slice(tableStart >= 0 ? tableStart : 0);
  const cells = tableText.split("\u0007");
  const coursesFound = [];
  let sectionOffset = 0;
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cleanText(cells[index]);
    if (/上午/.test(cell)) sectionOffset = 0;
    if (/下午/.test(cell)) sectionOffset = 4;
    if (/晚上/.test(cell)) sectionOffset = 8;
    if (!/^[1-4]$/.test(cell)) continue;
    const period = sectionOffset + Number(cell);
    for (let day = 1; day <= 7; day += 1) coursesFound.push(...extractCellCourses(cells[index + day] ?? "", day, period));
  }
  const unique = new Map();
  coursesFound.forEach((course) => {
    const key = [course.day, course.periodStart, course.name, course.teacher, course.room, weeksLabel(course.ranges)].join("|");
    unique.set(key, course);
  });
  return [...unique.values()];
}

function parsePlainText(text) {
  const found = [];
  for (const match of text.matchAll(COURSE_PATTERN)) {
    const name = cleanText(match[1]);
    if (!name || /^(节次|星期|上午|下午|晚上|第一学期)$/.test(name)) continue;
    const index = found.length;
    found.push(normalizeCourse({ name, day: (index % 7) + 1, period: Math.floor(index / 7) + 1, teacher: cleanText(match[4]), room: cleanText(match[5]), ranges: [[Number(match[2]), Number(match[3])]] }));
  }
  return found;
}

async function parseFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (extension === "json") return parseJSONText(new TextDecoder().decode(buffer));
  if (extension === "doc") {
    const docText = new TextDecoder("utf-16le").decode(buffer);
    const parsedDoc = parseLegacyDocText(docText);
    if (parsedDoc.length) return parsedDoc;
    return parsePlainText(docText);
  }
  return extension === "csv" ? parseCSVText(new TextDecoder().decode(buffer)) : parsePlainText(new TextDecoder().decode(buffer));
}

function openImportDialog() {
  pasteInput.value = "";
  importStatus.textContent = "";
  importDialog.showModal();
}

async function applyImport() {
  try {
    let parsed = [];
    if (fileInput.files?.[0]) parsed = await parseFile(fileInput.files[0]);
    if (!parsed.length && pasteInput.value.trim()) {
      parsed = pasteInput.value.includes(",") && pasteInput.value.split(/\r?\n/).length > 1 ? parseCSVText(pasteInput.value) : parsePlainText(pasteInput.value);
    }
    if (!parsed.length) {
      importStatus.textContent = "没有识别到课程。请检查文件格式，或先下载 CSV 模板。";
      return;
    }
    courses = parsed;
    selectedWeek = "all";
    renderWeekOptions();
    render();
    importDialog.close();
    showToast(`已导入 ${parsed.length} 门课程`);
  } catch (error) {
    importStatus.textContent = `导入失败：${error.message || "文件格式不正确"}`;
  }
}

function downloadFile(filename, content, mime) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: mime }));
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function downloadTemplate() {
  const csv = "课程名称,星期,开始节次,结束节次,教师,教室,周次\n高等数学,星期一,1,2,张老师,J01A201,1-16\n示例课程,星期三,5,5,李老师,线上,2-4,9-12\n";
  downloadFile("课表导入模板.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
  showToast("CSV 模板已下载");
}

function dateFromInput() {
  const value = $("#semesterStart").value;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(number) { return String(number).padStart(2, "0"); }
function formatDateShort(date) { return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`; }
function updateWeekRange() {
  const date = dateFromInput();
  const range = $("#weekRange");
  if (!date) { range.textContent = "请选择第 1 周周一"; return; }
  const end = addDays(date, 6);
  const weekday = date.getDay() || 7;
  const note = weekday === 1 ? "" : ` · 当前为星期${["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}，导出时仍按此日期作为第 1 周周一`;
  range.textContent = `第 1 周：${formatDateShort(date)} — ${formatDateShort(end)}${note}`;
}
function icsDate(date, time) { const [hour, minute] = time.split(":").map(Number); return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(hour)}${pad(minute)}00`; }
function addDays(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function escapeICS(value) { return String(value ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }

function exportICS() {
  const semesterStart = dateFromInput();
  if (!semesterStart) { showToast("请先填写有效的学期开始日"); return; }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kebiao Huanxin//CN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:我的课程表", "X-WR-TIMEZONE:Asia/Shanghai"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  courses.forEach((course, courseIndex) => {
    const [startTime] = PERIOD_TIMES[course.periodStart - 1] || PERIOD_TIMES[0];
    const [, endTime] = PERIOD_TIMES[course.periodEnd - 1] || PERIOD_TIMES[course.periodStart - 1] || PERIOD_TIMES[0];
    course.ranges.forEach(([weekStart, weekEnd], rangeIndex) => {
      const date = addDays(semesterStart, (weekStart - 1) * 7 + course.day - 1);
      const eventLines = [
        "BEGIN:VEVENT",
        `UID:${courseIndex}-${rangeIndex}-${date.getTime()}@kebiao-huanxin`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Shanghai:${icsDate(date, startTime)}`,
        `DTEND;TZID=Asia/Shanghai:${icsDate(date, endTime)}`,
        `SUMMARY:${escapeICS(course.name)}`,
        `LOCATION:${escapeICS(course.room)}`,
        `DESCRIPTION:${escapeICS(`教师：${course.teacher}\n周次：${weekStart === weekEnd ? weekStart : `${weekStart}-${weekEnd}`}周`)}`,
      ];
      if (weekEnd > weekStart) eventLines.push(`RRULE:FREQ=WEEKLY;COUNT=${weekEnd - weekStart + 1}`);
      lines.push(...eventLines, "END:VEVENT");
    });
  });
  lines.push("END:VCALENDAR");
  downloadFile("我的课程表.ics", lines.join("\r\n") + "\r\n", "text/calendar;charset=utf-8");
  showToast(`已生成 ${courses.length} 门课程的 iOS 日历文件`);
}

$("#importBtn").addEventListener("click", openImportDialog);
$("#guideImportBtn").addEventListener("click", openImportDialog);
$("#closeDialogBtn").addEventListener("click", () => importDialog.close());
$("#cancelImportBtn").addEventListener("click", () => importDialog.close());
$("#applyImportBtn").addEventListener("click", applyImport);
$("#exportBtn").addEventListener("click", exportICS);
$("#templateBtn").addEventListener("click", downloadTemplate);
$("#closeDetailBtn").addEventListener("click", () => $("#detailDialog").close());
$("#semesterStart").addEventListener("change", () => { updateWeekRange(); showToast("第 1 周日期已更新，导出日历时会按天计算"); });
weekFilter.addEventListener("change", (event) => { selectedWeek = event.target.value; render(); });
$("#clearBtn").addEventListener("click", () => {
  courses = [];
  selectedWeek = "all";
  renderWeekOptions();
  render();
  showToast("课表已清空");
});

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("dragging"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  if (event.dataTransfer.files?.[0]) {
    fileInput.files = event.dataTransfer.files;
    importStatus.textContent = `已选择：${event.dataTransfer.files[0].name}`;
  }
});
fileInput.addEventListener("change", () => { if (fileInput.files?.[0]) importStatus.textContent = `已选择：${fileInput.files[0].name}`; });

renderWeekOptions();
updateWeekRange();
render();
