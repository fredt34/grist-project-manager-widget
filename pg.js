// =============================================================================
// PROJECT GANTT PLUGIN
// =============================================================================

var projects = [];
var ganttMode = 'days'; // 'days' | 'months' | 'weeks' | 'year' | 'twoyears'
var ganttYear = new Date().getFullYear();
var ganttMonth = new Date().getMonth();
var PROJECTS_TABLE = 'PM_Projects';

var currentLang = 'fr';
var i18n = {
  fr: {
    colProjectName: 'Projet',
    ganttTitle: 'Diagramme de Gantt des Projets',
    ganttYear: 'Année :',
    ganttToday: "Aujourd'hui",
    ganttDays: 'Jours',
    ganttWeeks: 'Semaines',
    ganttMonths: 'Mois',
    ganttYear2: 'Année',
    ganttTwoYears: '2 Ans',
    ganttViewRange: 'Vue :',
    loading: 'Chargement...',
    noProjects: 'Aucun projet avec dates trouvé'
  },
  en: {
    colProjectName: 'Project',
    ganttTitle: 'Project Gantt Chart',
    ganttYear: 'Year:',
    ganttToday: 'Today',
    ganttDays: 'Days',
    ganttWeeks: 'Weeks',
    ganttMonths: 'Months',
    ganttYear2: 'Year',
    ganttTwoYears: '2 Years',
    ganttViewRange: 'View:',
    loading: 'Loading...',
    noProjects: 'No projects with dates found'
  }
};

function t(key) {
  return (i18n[currentLang] && i18n[currentLang][key]) || (i18n.fr[key]) || key;
}

function formatDate(d) {
  if (!d) return '';
  var date = new Date(d * 1000);
  if (isNaN(date.getTime())) {
    date = new Date(d);
    if (isNaN(date.getTime())) return '';
  }
  return date.toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getISOWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekStart(year, weekNum) {
  var jan4 = new Date(year, 0, 4);
  var dayOfWeek = jan4.getDay() || 7;
  var monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
  return monday;
}

async function loadData() {
  try {
    var data = await grist.docApi.fetchTable(PROJECTS_TABLE);
    projects = [];
    if (data && data.id) {
      for (var i = 0; i < data.id.length; i++) {
        projects.push({
          id: data.id[i],
          Name: data.Name ? data.Name[i] : '',
          Start_Date: data.Start_Date ? data.Start_Date[i] : null,
          End_Date: data.End_Date ? data.End_Date[i] : null,
          Color: data.Color ? data.Color[i] : '#6366f1',
          Status: data.Status ? data.Status[i] : 'active'
        });
      }
    }
    renderGanttView();
  } catch (e) {
    console.error('Error loading projects:', e);
    document.getElementById('gantt-view').innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;">Error loading projects. Please ensure the PM_Projects table exists.</div>';
  }
}

function setGanttMode(mode) {
  ganttMode = mode;
  renderGanttView();
}

function setGanttYear(year) {
  ganttYear = parseInt(year);
  renderGanttView();
}

function renderGanttView() {
  var container = document.getElementById('gantt-view');
  if (!container) return;

  var projectsWithDates = projects.filter(function(p) { return p.Start_Date || p.End_Date; });
  if (projectsWithDates.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">' + t('noProjects') + '</div>';
    return;
  }

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var dayNames = currentLang === 'fr' ? ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'] : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var monthNamesShort = currentLang === 'fr' ? ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var monthNames = currentLang === 'fr' ? ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var html = '<div class="gantt-container"><table class="gantt-table">';

  if (ganttMode === 'weeks') {
    var startWeek = getISOWeek(new Date(ganttYear, ganttMonth, 1));
    var numWeeks = 34;
    var weeks = [];
    for (var w = 0; w < numWeeks; w++) {
      var wn = startWeek + w;
      var yr = ganttYear;
      if (wn > 52) { wn -= 52; yr++; }
      var ws = getWeekStart(yr, wn);
      var we = new Date(ws); we.setDate(we.getDate() + 6);
      weeks.push({ num: wn, year: yr, start: ws, end: we });
    }

    html += '<thead><tr><th class="gantt-task-label" style="text-align:left;">' + t('colProjectName') + '</th>';
    for (var wi = 0; wi < weeks.length; wi++) {
      var wk = weeks[wi];
      var isCurrentWeek = getISOWeek(today) === wk.num && today.getFullYear() === wk.year;
      html += '<th style="min-width:80px;' + (isCurrentWeek ? 'background:#fef2f2;color:#ef4444;' : '') + '">';
      html += '<div style="font-size:11px;font-weight:800;">S' + wk.num + '</div>';
      html += '<div style="font-size:9px;font-weight:400;color:#94a3b8;">' + monthNamesShort[wk.start.getMonth()] + ' ' + String(wk.start.getFullYear()).substring(2) + '</div>';
      html += '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var pi = 0; pi < projectsWithDates.length; pi++) {
      var proj = projectsWithDates[pi];
      var barColor = proj.Color || '#6366f1';
      html += '<tr>';
      html += '<td class="gantt-task-label">' + sanitize(proj.Name) + '</td>';

      var pStart = proj.Start_Date ? new Date(proj.Start_Date * 1000) : null;
      var pEnd = proj.End_Date ? new Date(proj.End_Date * 1000) : null;
      if (!pStart && pEnd) pStart = pEnd;
      if (!pEnd && pStart) pEnd = pStart;
      if (pStart) pStart.setHours(0, 0, 0, 0);
      if (pEnd) pEnd.setHours(23, 59, 59, 999);

      var barStartIdx = -1, barEndIdx = -1;
      for (var wi = 0; wi < weeks.length; wi++) {
        var wk = weeks[wi];
        if (pStart && pEnd && pStart <= wk.end && pEnd >= wk.start) {
          if (barStartIdx === -1) barStartIdx = wi;
          barEndIdx = wi;
        }
      }

      for (var wi = 0; wi < weeks.length; wi++) {
        var isCurrentWeek = getISOWeek(today) === weeks[wi].num && today.getFullYear() === weeks[wi].year;
        html += '<td class="gantt-cell" style="position:relative;' + (isCurrentWeek ? 'background:#fef2f2;' : '') + '">';
        if (wi === barStartIdx) {
          var spanCols = barEndIdx - barStartIdx + 1;
          var widthPx = spanCols * 80;
          html += '<div class="gantt-bar" style="left:2px;width:' + widthPx + 'px;background:' + barColor + ';color:white;" title="' + sanitize(proj.Name) + '">' + sanitize(proj.Name) + '</div>';
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    
    var viewStartMonth = monthNames[weeks[0].start.getMonth()];
    var viewEndMonth = monthNames[weeks[weeks.length - 1].start.getMonth()];
    html += '<div class="gantt-footer"><span>🌟 ' + projectsWithDates.length + ' ' + (currentLang === 'fr' ? 'projets' : 'projects') + '</span><span>' + t('ganttViewRange') + ' ' + viewStartMonth + ' - ' + viewEndMonth + ' ' + ganttYear + '</span></div></div>';
    container.innerHTML = html;
    return;
  }

  if (ganttMode === 'year' || ganttMode === 'twoyears') {
    var numYears = ganttMode === 'twoyears' ? 2 : 1;
    var totalMonths = numYears * 12;
    var startYr = ganttYear;
    var colWidth = ganttMode === 'twoyears' ? 50 : 70;

    html += '<thead>';
    if (ganttMode === 'twoyears') {
      html += '<tr><th class="gantt-task-label" style="text-align:left;" rowspan="2">' + t('colProjectName') + '</th>';
      html += '<th colspan="12" style="font-size:12px;font-weight:800;background:#f8fafc;">' + startYr + '</th>';
      html += '<th colspan="12" style="font-size:12px;font-weight:800;background:#f8fafc;">' + (startYr + 1) + '</th>';
      html += '</tr><tr>';
    } else {
      html += '<tr><th class="gantt-task-label" style="text-align:left;">' + t('colProjectName') + '</th>';
    }
    for (var ym = 0; ym < totalMonths; ym++) {
      var yr = startYr + Math.floor(ym / 12);
      var mo = ym % 12;
      var isCurrent = (yr === today.getFullYear() && mo === today.getMonth());
      html += '<th style="min-width:' + colWidth + 'px;' + (isCurrent ? 'background:#fef2f2;color:#ef4444;' : '') + '">' + monthNamesShort[mo].substring(0, 3) + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var pi = 0; pi < projectsWithDates.length; pi++) {
      var proj = projectsWithDates[pi];
      var barColor = proj.Color || '#6366f1';
      html += '<tr>' + '<td class="gantt-task-label">' + sanitize(proj.Name) + '</td>';

      var pStart = proj.Start_Date ? new Date(proj.Start_Date * 1000) : null;
      var pEnd = proj.End_Date ? new Date(proj.End_Date * 1000) : null;
      if (!pStart && pEnd) pStart = new Date(pEnd);
      if (!pEnd && pStart) pEnd = new Date(pStart);
      if (pStart) pStart.setHours(0, 0, 0, 0);
      if (pEnd) pEnd.setHours(23, 59, 59, 999);

      var yBarStart = -1, yBarEnd = -1;
      for (var ym = 0; ym < totalMonths; ym++) {
        var yr = startYr + Math.floor(ym / 12);
        var mo = ym % 12;
        var ms = new Date(yr, mo, 1);
        var me = new Date(yr, mo + 1, 0, 23, 59, 59, 999);
        if (pStart && pEnd && pStart <= me && pEnd >= ms) {
          if (yBarStart === -1) yBarStart = ym;
          yBarEnd = ym;
        }
      }

      for (var ym = 0; ym < totalMonths; ym++) {
        var yr2 = startYr + Math.floor(ym / 12);
        var mo2 = ym % 12;
        var isCurrent2 = (yr2 === today.getFullYear() && mo2 === today.getMonth());
        html += '<td class="gantt-cell" style="position:relative;min-width:' + colWidth + 'px;' + (isCurrent2 ? 'background:#fef2f2;' : '') + '">';
        if (ym === yBarStart) {
          var yBarW = (yBarEnd - yBarStart + 1) * colWidth;
          html += '<div class="gantt-bar" style="left:2px;width:' + yBarW + 'px;background:' + barColor + ';color:white;" title="' + sanitize(proj.Name) + '">' + sanitize(proj.Name) + '</div>';
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += '<div class="gantt-footer"><span>🌟 ' + projectsWithDates.length + ' ' + (currentLang === 'fr' ? 'projets' : 'projects') + '</span><span>' + t('ganttViewRange') + ' ' + (ganttMode === 'twoyears' ? startYr + ' - ' + (startYr + 1) : startYr) + '</span></div></div>';
    container.innerHTML = html;
    return;
  }

  if (ganttMode === 'months') {
    var startDate = new Date(ganttYear, 0, 1);
    var endDate = new Date(ganttYear, 11, 31);
    var todayMonth = today.getMonth();
    var todayYear = today.getFullYear();
    var todayDayPct = (todayYear === ganttYear && todayMonth >= 0 && todayMonth < 12) ? Math.round((today.getDate() - 1) / new Date(ganttYear, todayMonth + 1, 0).getDate() * 100) : -1;

    html += '<thead><tr><th class="gantt-task-label" style="text-align:left;">' + t('colProjectName') + '</th>';
    for (var m = 0; m < 12; m++) {
      var isCurrentMonth = (ganttYear === todayYear && m === todayMonth);
      html += '<th colspan="1" style="' + (isCurrentMonth ? 'background:#fef2f2;color:#ef4444;' : '') + '">' + monthNames[m].substring(0, 3).toUpperCase() + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var pi = 0; pi < projectsWithDates.length; pi++) {
      var proj = projectsWithDates[pi];
      var barColor = proj.Color || '#6366f1';
      html += '<tr>' + '<td class="gantt-task-label">' + sanitize(proj.Name) + '</td>';

      var mTStart = proj.Start_Date ? new Date(proj.Start_Date * 1000) : null;
      var mTEnd = proj.End_Date ? new Date(proj.End_Date * 1000) : null;
      if (!mTStart && mTEnd) mTStart = new Date(mTEnd);
      if (!mTEnd && mTStart) mTEnd = new Date(mTStart);
      if (mTStart) mTStart.setHours(0, 0, 0, 0);
      if (mTEnd) mTEnd.setHours(23, 59, 59, 999);

      var mBarStartIdx = -1, mBarEndIdx = -1;
      for (var m = 0; m < 12; m++) {
        var ms = new Date(ganttYear, m, 1);
        var me = new Date(ganttYear, m + 1, 0, 23, 59, 59, 999);
        if (mTStart && mTEnd && mTStart <= me && mTEnd >= ms) {
          if (mBarStartIdx === -1) mBarStartIdx = m;
          mBarEndIdx = m;
        }
      }

      for (var m = 0; m < 12; m++) {
        var isTodayMonth = (ganttYear === todayYear && m === todayMonth);
        html += '<td class="gantt-cell" style="position:relative;min-width:80px;">';
        if (isTodayMonth && todayDayPct >= 0) {
          html += '<div style="position:absolute;top:0;bottom:0;left:' + todayDayPct + '%;width:2px;background:#ef4444;z-index:1;pointer-events:none;"></div>';
        }
        if (m === mBarStartIdx) {
          var mBarWidth = (mBarEndIdx - mBarStartIdx + 1) * 80;
          html += '<div class="gantt-bar" style="left:2px;width:' + mBarWidth + 'px;background:' + barColor + ';color:white;" title="' + sanitize(proj.Name) + '">' + sanitize(proj.Name) + '</div>';
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += '<div class="gantt-footer"><span>🌟 ' + projectsWithDates.length + ' ' + (currentLang === 'fr' ? 'projets' : 'projects') + '</span><span>' + t('ganttViewRange') + ' ' + monthNames[0] + ' - ' + monthNames[11] + ' ' + ganttYear + '</span></div></div>';
    container.innerHTML = html;
    return;
  }

  if (ganttMode === 'days') {
    var startDate = new Date(ganttYear, ganttMonth - 1, 1);
    var endDate = new Date(ganttYear, ganttMonth + 2, 0);
    var days = [];
    var d = new Date(startDate);
    while (d <= endDate) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }

    html += '<thead><tr><th class="gantt-task-label" style="text-align:left;" rowspan="2">' + t('colProjectName') + '</th>';
    var prevMonth = -1;
    for (var di0 = 0; di0 < days.length; di0++) {
      var dm = days[di0].getMonth();
      if (dm !== prevMonth) {
        var colspan = 0;
        for (var di1 = di0; di1 < days.length && days[di1].getMonth() === dm; di1++) colspan++;
        html += '<th colspan="' + colspan + '" style="font-size:11px;font-weight:700;color:#475569;background:#f8fafc;border-bottom:1px solid #e2e8f0;">' + monthNames[dm].toUpperCase() + '</th>';
        prevMonth = dm;
      }
    }
    html += '</tr><tr>';
    for (var di = 0; di < days.length; di++) {
      var dd = days[di];
      var isToday = dd.getTime() === today.getTime();
      var isWeekend = dd.getDay() === 0 || dd.getDay() === 6;
      html += '<th class="' + (isToday ? 'today-col' : '') + (isWeekend ? ' weekend-col' : '') + '">';
      html += '<div>' + dd.getDate() + '</div>';
      html += '<div style="font-size:8px;">' + dayNames[dd.getDay()] + '</div>';
      html += '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var pi = 0; pi < projectsWithDates.length; pi++) {
      var proj = projectsWithDates[pi];
      var barColor = proj.Color || '#6366f1';
      html += '<tr>' + '<td class="gantt-task-label">' + sanitize(proj.Name) + '</td>';

      var pStart = proj.Start_Date ? new Date(proj.Start_Date * 1000) : null;
      var pEnd = proj.End_Date ? new Date(proj.End_Date * 1000) : null;
      if (!pStart && pEnd) pStart = new Date(pEnd);
      if (!pEnd && pStart) pEnd = new Date(pStart);
      if (pStart) pStart.setHours(0, 0, 0, 0);
      if (pEnd) pEnd.setHours(23, 59, 59, 999);

      var barStartIdx = -1, barEndIdx = -1;
      if (pStart && pEnd) {
        for (var di = 0; di < days.length; di++) {
          var dday = days[di];
          if (dday >= pStart && dday <= pEnd) {
            if (barStartIdx === -1) barStartIdx = di;
            barEndIdx = di;
          }
        }
      }

      for (var di = 0; di < days.length; di++) {
        var dd = days[di];
        var isToday = dd.getTime() === today.getTime();
        var isWeekend = dd.getDay() === 0 || dd.getDay() === 6;
        var cellClass = (isToday ? 'today-col' : '') + (isWeekend ? ' weekend-col' : '');
        html += '<td class="gantt-cell ' + cellClass + '" style="position:relative;">';
        if (di === barStartIdx) {
          var spanDays = barEndIdx - barStartIdx + 1;
          var widthPx = spanDays * 36;
          html += '<div class="gantt-bar" style="left:2px;width:' + widthPx + 'px;background:' + barColor + ';color:white;" title="' + sanitize(proj.Name) + '">' + sanitize(proj.Name) + '</div>';
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += '<div class="gantt-footer"><span>🌟 ' + projectsWithDates.length + ' ' + (currentLang === 'fr' ? 'projets' : 'projects') + '</span><span>' + t('ganttViewRange') + ' ' + monthNames[ganttMonth] + ' ' + ganttYear + '</span></div></div>';
    container.innerHTML = html;
  }
}

function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
  await loadData();
});

// Exposed functions for HTML
window.setGanttMode = setGanttMode;
window.setGanttYear = setGanttYear;