// =============================================================================
// PROJECT GANTT PLUGIN
// =============================================================================

var projects = [];
var ganttMode = 'months'; // 'days' | 'months' | 'weeks' | 'year' | 'twoyears'
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
    noProjects: 'Aucun projet avec dates trouvé',
    noDatesProjects: 'Projets sans dates',
    statusActive: 'Actif',
    statusCompleted: 'Terminé',
    statusArchived: 'Archivé',
    start: 'Début',
    end: 'Fin',
    status: 'Statut',
    lead: 'Responsable',
    exportPng: 'Export PNG'
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
    noProjects: 'No projects with dates found',
    noDatesProjects: 'Projects without dates',
    statusActive: 'Active',
    statusCompleted: 'Completed',
    statusArchived: 'Archived',
    start: 'Start',
    end: 'End',
    status: 'Status',
    lead: 'Lead',
    exportPng: 'Export PNG'
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

// =============================================================================
// #2 — Status-based bar color
// =============================================================================
function getBarColor(proj) {
  var status = (proj.Status || '').toLowerCase();
  if (status === 'completed' || status === 'done' || status === 'terminé' || status === 'termine') return '#22c55e';
  if (status === 'archived' || status === 'archivé' || status === 'archive') return '#94a3b8';
  if (status === 'on_hold' || status === 'on hold' || status === 'en attente') return '#f59e0b';
  // Use project color for active/default
  return proj.Color || '#6366f1';
}

function getStatusLabel(status) {
  var s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'done') return t('statusCompleted');
  if (s === 'archived') return t('statusArchived');
  if (s === 'active') return t('statusActive');
  return status || '—';
}

// =============================================================================
// #5 — Tooltip popup
// =============================================================================
var _tooltipEl = null;

function createTooltip() {
  if (_tooltipEl) return;
  _tooltipEl = document.createElement('div');
  _tooltipEl.id = 'gantt-tooltip';
  _tooltipEl.className = 'gantt-tooltip';
  _tooltipEl.style.display = 'none';
  document.body.appendChild(_tooltipEl);
  document.addEventListener('mousemove', function(e) {
    if (_tooltipEl.style.display === 'block') {
      var x = e.clientX + 14;
      var y = e.clientY + 14;
      if (x + 260 > window.innerWidth) x = e.clientX - 270;
      if (y + 160 > window.innerHeight) y = e.clientY - 160;
      _tooltipEl.style.left = x + 'px';
      _tooltipEl.style.top = y + 'px';
    }
  });
}

function showTooltip(proj) {
  if (!_tooltipEl) createTooltip();
  var startStr = proj.Start_Date ? formatDate(proj.Start_Date) : '—';
  var endStr = proj.End_Date ? formatDate(proj.End_Date) : '—';
  var statusStr = getStatusLabel(proj.Status);
  var desc = proj.Description ? '<div class="gantt-tooltip-desc">' + sanitize(proj.Description) + '</div>' : '';
  var lead = proj.Lead ? '<div class="gantt-tooltip-row"><span class="gantt-tooltip-label">' + t('lead') + '</span><span>' + sanitize(proj.Lead) + '</span></div>' : '';
  var dotColor = getBarColor(proj);
  _tooltipEl.innerHTML =
    '<div class="gantt-tooltip-header">' +
      '<span class="gantt-tooltip-dot" style="background:' + dotColor + ';"></span>' +
      '<strong>' + sanitize(proj.Name) + '</strong>' +
    '</div>' +
    desc +
    '<div class="gantt-tooltip-row"><span class="gantt-tooltip-label">' + t('start') + '</span><span>' + startStr + '</span></div>' +
    '<div class="gantt-tooltip-row"><span class="gantt-tooltip-label">' + t('end') + '</span><span>' + endStr + '</span></div>' +
    '<div class="gantt-tooltip-row"><span class="gantt-tooltip-label">' + t('status') + '</span><span>' + statusStr + '</span></div>' +
    lead;
  _tooltipEl.style.display = 'block';
}

function hideTooltip() {
  if (_tooltipEl) _tooltipEl.style.display = 'none';
}

// Attach tooltip events after rendering (using event delegation on the container)
function attachTooltipEvents(container) {
  container.addEventListener('mouseover', function(e) {
    var bar = e.target.closest ? e.target.closest('.gantt-bar') : null;
    if (bar) {
      var pid = parseInt(bar.getAttribute('data-pid'));
      var proj = projects.find(function(p) { return p.id === pid; });
      if (proj) showTooltip(proj);
    }
  });
  container.addEventListener('mouseout', function(e) {
    var bar = e.target.closest ? e.target.closest('.gantt-bar') : null;
    if (bar) hideTooltip();
  });
}

// =============================================================================
// DATA LOADING
// =============================================================================
async function loadData() {
  var container = document.getElementById('gantt-view');
  if (!container) return;

  console.log('loadData: Fetching table ' + PROJECTS_TABLE);

  try {
    var data = await grist.docApi.fetchTable(PROJECTS_TABLE);
    console.log('loadData: Data received from Grist', data);

    projects = [];
    if (data && data.id) {
      for (var i = 0; i < data.id.length; i++) {
        projects.push({
          id: data.id[i],
          Name: data.Name ? data.Name[i] : '',
          Description: data.Description ? data.Description[i] : '',
          Start_Date: data.Start_Date ? data.Start_Date[i] : null,
          End_Date: data.End_Date ? data.End_Date[i] : null,
          Color: data.Color ? data.Color[i] : '#6366f1',
          Status: data.Status ? data.Status[i] : 'active',
          Lead: data.Lead ? data.Lead[i] : ''
        });
      }
    }
    console.log('loadData: Parsed ' + projects.length + ' projects');
    renderGanttView();
  } catch (e) {
    console.error('loadData error:', e);
    if (container) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;">Erreur de chargement. Vérifiez que la table PM_Projects existe.</div>';
    }
  }
}

function setGanttMode(mode) {
  ganttMode = mode;
  renderGanttView();
}

function setGanttYear(year) {
  ganttYear = parseInt(year);
  // sync year selector
  var sel = document.getElementById('year-select');
  if (sel) sel.value = ganttYear;
  renderGanttView();
}

// =============================================================================
// #7 — Navigation helpers
// =============================================================================
function navigatePrev() {
  if (ganttMode === 'days') {
    ganttMonth--;
    if (ganttMonth < 0) { ganttMonth = 11; ganttYear--; }
  } else if (ganttMode === 'weeks') {
    ganttMonth--;
    if (ganttMonth < 0) { ganttMonth = 11; ganttYear--; }
  } else {
    ganttYear--;
  }
  var sel = document.getElementById('year-select');
  if (sel) sel.value = ganttYear;
  renderGanttView();
}

function navigateNext() {
  if (ganttMode === 'days') {
    ganttMonth++;
    if (ganttMonth > 11) { ganttMonth = 0; ganttYear++; }
  } else if (ganttMode === 'weeks') {
    ganttMonth++;
    if (ganttMonth > 11) { ganttMonth = 0; ganttYear++; }
  } else {
    ganttYear++;
  }
  var sel = document.getElementById('year-select');
  if (sel) sel.value = ganttYear;
  renderGanttView();
}

// =============================================================================
// #10 — Export to PNG
// =============================================================================
function exportToPng() {
  var ganttContainer = document.querySelector('.gantt-container');
  if (!ganttContainer) { alert('Rien à exporter.'); return; }

  // Use html2canvas if available
  if (typeof html2canvas !== 'undefined') {
    html2canvas(ganttContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(function(canvas) {
      var link = document.createElement('a');
      link.download = 'gantt-projets-' + ganttYear + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
    return;
  }

  // Fallback: load html2canvas dynamically
  var script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  script.onload = function() {
    html2canvas(ganttContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(function(canvas) {
      var link = document.createElement('a');
      link.download = 'gantt-projets-' + ganttYear + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };
  script.onerror = function() {
    alert('Impossible de charger html2canvas. Vérifiez votre connexion internet.');
  };
  document.head.appendChild(script);
}

// =============================================================================
// RENDER
// =============================================================================
function renderGanttView() {
  var container = document.getElementById('gantt-view');
  if (!container) return;

  var projectsWithDates = projects.filter(function(p) { return p.Start_Date || p.End_Date; });
  var projectsNoDates = projects.filter(function(p) { return !p.Start_Date && !p.End_Date; });

  if (projectsWithDates.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">' + t('noProjects') + '</div>';
    return;
  }

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var dayNames = currentLang === 'fr' ? ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'] : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var monthNamesShort = currentLang === 'fr' ? ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var monthNames = currentLang === 'fr' ? ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Helper: build a gantt bar div
  function barDiv(proj, widthPx, leftPx) {
    var barColor = getBarColor(proj);
    return '<div class="gantt-bar" data-pid="' + proj.id + '" style="left:' + (leftPx || 2) + 'px;width:' + widthPx + 'px;background:' + barColor + ';color:white;">' + sanitize(proj.Name) + '</div>';
  }

  // Helper: today line absolute div (full cell height)
  function todayLine(pct) {
    return '<div class="gantt-today-line" style="left:' + pct + '%;"></div>';
  }

  var html = '<div class="gantt-scroll-wrapper"><div class="gantt-container"><table class="gantt-table">';

  // -------------------------------------------------------------------------
  // WEEKS MODE
  // -------------------------------------------------------------------------
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

    // #8 today column index
    var todayWeekIdx = -1;
    var todayWeekPct = 0;
    for (var wi = 0; wi < weeks.length; wi++) {
      if (today >= weeks[wi].start && today <= weeks[wi].end) {
        todayWeekIdx = wi;
        var dayInWeek = (today - weeks[wi].start) / 86400000;
        todayWeekPct = Math.round(dayInWeek / 7 * 100);
        break;
      }
    }

    html += '<thead><tr><th class="gantt-task-label" style="text-align:left;">' + t('colProjectName') + '</th>';
    for (var wi = 0; wi < weeks.length; wi++) {
      var wk = weeks[wi];
      var isCurrentWeek = (wi === todayWeekIdx);
      html += '<th style="min-width:80px;' + (isCurrentWeek ? 'background:#fef2f2;color:#ef4444;' : '') + '">';
      html += '<div style="font-size:11px;font-weight:800;">S' + wk.num + '</div>';
      html += '<div style="font-size:9px;font-weight:400;color:#94a3b8;">' + monthNamesShort[wk.start.getMonth()] + ' ' + String(wk.start.getFullYear()).substring(2) + '</div>';
      html += '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var pi = 0; pi < projectsWithDates.length; pi++) {
      var proj = projectsWithDates[pi];
      html += '<tr>';
      html += '<td class="gantt-task-label">' + sanitize(proj.Name) + '</td>';

      var pStart = proj.Start_Date ? new Date(proj.Start_Date * 1000) : null;
      var pEnd = proj.End_Date ? new Date(proj.End_Date * 1000) : null;
      if (!pStart && pEnd) pStart = new Date(pEnd);
      if (!pEnd && pStart) pEnd = new Date(pStart);
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
        var isCurrentWeek = (wi === todayWeekIdx);
        html += '<td class="gantt-cell" style="position:relative;' + (isCurrentWeek ? 'background:#fef2f2;' : '') + '">';
        // #8 today line
        if (wi === todayWeekIdx) html += todayLine(todayWeekPct);
        if (wi === barStartIdx) {
          var spanCols = barEndIdx - barStartIdx + 1;
          html += barDiv(proj, spanCols * 80);
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    var viewStartMonth = monthNames[weeks[0].start.getMonth()];
    var viewEndMonth = monthNames[weeks[weeks.length - 1].start.getMonth()];
    html += buildFooter(projectsWithDates.length, projectsNoDates, viewStartMonth + ' – ' + viewEndMonth + ' ' + ganttYear);
    html += '</div></div>';
    container.innerHTML = html;
    attachTooltipEvents(container);
    return;
  }

  // -------------------------------------------------------------------------
  // YEAR / TWOYEARS MODE
  // -------------------------------------------------------------------------
  if (ganttMode === 'year' || ganttMode === 'twoyears') {
    var numYears = ganttMode === 'twoyears' ? 2 : 1;
    var totalMonths = numYears * 12;
    var startYr = ganttYear;
    var colWidth = ganttMode === 'twoyears' ? 50 : 70;

    // #8 today column index
    var todayMonthIdx = -1;
    var todayMonthPct = 0;
    for (var ym = 0; ym < totalMonths; ym++) {
      var yr = startYr + Math.floor(ym / 12);
      var mo = ym % 12;
      if (yr === today.getFullYear() && mo === today.getMonth()) {
        todayMonthIdx = ym;
        var daysInMonth = new Date(yr, mo + 1, 0).getDate();
        todayMonthPct = Math.round((today.getDate() - 1) / daysInMonth * 100);
        break;
      }
    }

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
      var isCurrent = (ym === todayMonthIdx);
      html += '<th style="min-width:' + colWidth + 'px;' + (isCurrent ? 'background:#fef2f2;color:#ef4444;' : '') + '">' + monthNamesShort[mo].substring(0, 3) + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var pi = 0; pi < projectsWithDates.length; pi++) {
      var proj = projectsWithDates[pi];
      html += '<tr><td class="gantt-task-label">' + sanitize(proj.Name) + '</td>';

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
        var isCurrent2 = (ym === todayMonthIdx);
        html += '<td class="gantt-cell" style="position:relative;min-width:' + colWidth + 'px;' + (isCurrent2 ? 'background:#fef2f2;' : '') + '">';
        // #8 today line
        if (ym === todayMonthIdx) html += todayLine(todayMonthPct);
        if (ym === yBarStart) {
          var yBarW = (yBarEnd - yBarStart + 1) * colWidth;
          html += barDiv(proj, yBarW);
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += buildFooter(projectsWithDates.length, projectsNoDates, ganttMode === 'twoyears' ? startYr + ' – ' + (startYr + 1) : String(startYr));
    html += '</div></div>';
    container.innerHTML = html;
    attachTooltipEvents(container);
    return;
  }

  // -------------------------------------------------------------------------
  // MONTHS MODE
  // -------------------------------------------------------------------------
  if (ganttMode === 'months') {
    var todayMonth = today.getMonth();
    var todayYear = today.getFullYear();
    var todayDayPct = (todayYear === ganttYear) ? Math.round((today.getDate() - 1) / new Date(ganttYear, todayMonth + 1, 0).getDate() * 100) : -1;

    html += '<thead><tr><th class="gantt-task-label" style="text-align:left;">' + t('colProjectName') + '</th>';
    for (var m = 0; m < 12; m++) {
      var isCurrentMonth = (ganttYear === todayYear && m === todayMonth);
      html += '<th colspan="1" style="' + (isCurrentMonth ? 'background:#fef2f2;color:#ef4444;' : '') + '">' + monthNames[m].substring(0, 3).toUpperCase() + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var pi = 0; pi < projectsWithDates.length; pi++) {
      var proj = projectsWithDates[pi];
      html += '<tr><td class="gantt-task-label">' + sanitize(proj.Name) + '</td>';

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
        if (isTodayMonth && todayDayPct >= 0) html += todayLine(todayDayPct);
        if (m === mBarStartIdx) {
          var mBarWidth = (mBarEndIdx - mBarStartIdx + 1) * 80;
          html += barDiv(proj, mBarWidth);
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += buildFooter(projectsWithDates.length, projectsNoDates, monthNames[0] + ' – ' + monthNames[11] + ' ' + ganttYear);
    html += '</div></div>';
    container.innerHTML = html;
    attachTooltipEvents(container);
    return;
  }

  // -------------------------------------------------------------------------
  // DAYS MODE
  // -------------------------------------------------------------------------
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
      html += '<tr><td class="gantt-task-label">' + sanitize(proj.Name) + '</td>';

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
        if (isToday) html += todayLine(50);
        if (di === barStartIdx) {
          var spanDays = barEndIdx - barStartIdx + 1;
          html += barDiv(proj, spanDays * 36);
        }
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += buildFooter(projectsWithDates.length, projectsNoDates, monthNames[ganttMonth] + ' ' + ganttYear);
    html += '</div></div>';
    container.innerHTML = html;
    attachTooltipEvents(container);
  }
}

// =============================================================================
// #6 — Footer with "no dates" projects list
// =============================================================================
function buildFooter(countWithDates, projectsNoDates, rangeLabel) {
  var html = '<div class="gantt-footer">';
  html += '<span>🌟 ' + countWithDates + ' ' + (currentLang === 'fr' ? 'projets' : 'projects') + '</span>';
  html += '<span>' + t('ganttViewRange') + ' ' + rangeLabel + '</span>';
  html += '</div>';

  if (projectsNoDates && projectsNoDates.length > 0) {
    html += '<div class="gantt-no-dates-section">';
    html += '<div class="gantt-no-dates-title">⚠️ ' + t('noDatesProjects') + ' (' + projectsNoDates.length + ')</div>';
    html += '<div class="gantt-no-dates-list">';
    for (var i = 0; i < projectsNoDates.length; i++) {
      var p = projectsNoDates[i];
      var dotColor = getBarColor(p);
      html += '<span class="gantt-no-dates-item"><span class="gantt-no-dates-dot" style="background:' + dotColor + ';"></span>' + sanitize(p.Name) + '</span>';
    }
    html += '</div></div>';
  }
  return html;
}

// =============================================================================
// UTILS
// =============================================================================
function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isInsideGrist() {
  try { return window.frameElement !== null || window !== window.parent; }
  catch (e) { return true; }
}

// =============================================================================
// INIT
// =============================================================================
if (!isInsideGrist()) {
  var container = document.getElementById('gantt-view');
  if (container) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;">' +
      '<strong>Mode Test :</strong> Ce plugin doit être exécuté à l\'intérieur de Grist pour accéder aux données.<br>' +
      'Veuillez configurer ce fichier comme Widget Personnalisé dans Grist.' +
      '</div>';
  }
} else {
  (async function init() {
    try {
      await grist.ready({ requiredAccess: 'full' });
      await loadData();

      // #1 — Live data refresh
      if (typeof grist.onRecords === 'function') {
        var _liveReloadTimer = null;
        grist.onRecords(function() {
          if (_liveReloadTimer) clearTimeout(_liveReloadTimer);
          _liveReloadTimer = setTimeout(function() {
            loadData();
          }, 500);
        });
      }
    } catch (e) {
      console.error('Initialization error:', e);
      var container = document.getElementById('gantt-view');
      if (container) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;">Erreur d\'initialisation : ' + e.message + '</div>';
      }
    }
  })();
}

// Exposed functions for HTML controls
window.setGanttMode = setGanttMode;
window.setGanttYear = setGanttYear;
window.navigatePrev = navigatePrev;
window.navigateNext = navigateNext;
window.exportToPng = exportToPng;
