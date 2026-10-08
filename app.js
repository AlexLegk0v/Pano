/* ============================================================
   app.js — логика тура панорам для Krpano 1.19-pr16
   Работает только с krpano.js (без tour.js, tour.swf, defaultskin.xml)
   ============================================================ */

var krpano = null;       // ссылка на krpano API
var currentIndex = 0;    // индекс текущей панорамы в массиве PANORAMAS
var history = [];        // история переходов
var historyIndex = -1;
var NEAREST_COUNT = 5;   // сколько ближайших панорам показывать стрелками

/* ---- Инициализация ---- */
window.addEventListener("load", initTour);

function initTour() {
  if (typeof PANORAMAS === "undefined" || PANORAMAS.length === 0) {
    showStatus("Нет данных. Сгенерируйте tour_config.js из CSV.");
    return;
  }

  document.getElementById("pano-count").textContent = PANORAMAS.length;

  // Считаем границы для мини-карты
  computeBounds();

  // Рендерим список
  renderPanoList();

  // Рендерим мини-карту
  drawMinimap();

  // Загружаем первую панораму
  loadPanoByIndex(0, true);

  // Обновляем кнопки
  updateNavButtons();
}

/* ---- Загрузка панорамы по индексу ---- */
function loadPanoByIndex(index, isInitial) {
  if (index < 0 || index >= PANORAMAS.length) return;

  var pano = PANORAMAS[index];
  currentIndex = index;

  // История
  if (!isInitial) {
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    history.push(index);
    historyIndex = history.length - 1;
  } else {
    history = [index];
    historyIndex = 0;
  }

  // Обновляем инфопанель
  document.getElementById("cur-filename").textContent = pano.filename;
  document.getElementById("cur-x").textContent = pano.x.toFixed(3);
  document.getElementById("cur-y").textContent = pano.y.toFixed(3);
  document.getElementById("cur-z").textContent = pano.z.toFixed(3);
  document.getElementById("cur-yaw").textContent = pano.yaw.toFixed(2) + "°";

  // Подсветка в списке
  updateActiveItem();

  // Обновляем мини-карту
  drawMinimap();

  // Обновляем расстояния в списке
  updateDistances();

  // Обновляем кнопки
  updateNavButtons();

  // Строим XML и загружаем в krpano
  var xml = buildSceneXML(index);

  if (!krpano) {
    // Первая инициализация
    embedpano({
      swf: null,                       // нет Flash
      xml: xml,
      target: "krpano",
      html5: "prefer",
      passQueryParameters: true,
      onready: function(krpanoObj) {
        krpano = krpanoObj;
        showStatus("Готово. Всего панорам: " + PANORAMAS.length);
      }
    });
  } else {
    // Последующие переходы
    krpano.call("loadxml(" + escapeXML(xml) + ", null, null, BLEND(0.8));");
  }
}

/* ---- Сборка XML для krpano ---- */
function buildSceneXML(index) {
  var pano = PANORAMAS[index];
  var imgPath = "panoramicImage/" + pano.filename;

  // Находим ближайшие панорамы
  var nearest = findNearest(index, NEAREST_COUNT);

  // Строим hotspots
  var hotspotsXML = "";

  for (var i = 0; i < nearest.length; i++) {
    var n = nearest[i];
    var targetPano = PANORAMAS[n.index];
    var az = azimuth(pano.x, pano.y, targetPano.x, targetPano.y);
    // В krpano: ath = азимут hotspot, atv = 0 (горизонт)
    var ath = az.toFixed(2);
    var dist = n.dist.toFixed(2);

    // Цвет и размер в зависимости от расстояния
    var scale = dist > 10 ? "0.6" : (dist > 5 ? "0.75" : "0.9");

    hotspotsXML += '\n' +
      '      <hotspot name="spot_' + n.index + '"' +
      ' url="hotspot_arrow.png"' +
      ' ath="' + ath + '"' +
      ' atv="0"' +
      ' scale="' + scale + '"' +
      ' edge="center"' +
      ' distorted="false"' +
      ' onclick="js(loadPanoByIndex(' + n.index + '))"' +
      ' onhover="showtext(Перейти → ' + targetPano.filename + '\n' + dist + ' м)"' +
      ' />';
  }

  // Полный XML со встроенным скином (не нужен defaultskin.xml)
  var xml =
    '<krpano>' +
    '  <preview type="grid();" />' +
    '  <skin_settings layout5_menu_openbuttons="false" layout5_nodirections="true"/>' +
    '  <action name="setup_view">' +
    '    set(view.hlookat, ' + pano.yaw.toFixed(2) + ');' +
    '    set(view.vlookat, 0);' +
    '    set(view.fov, 90);' +
    '    set(view.fovmin, 30);' +
    '    set(view.fovmax, 120);' +
    '  </action>' +
    '  <scene name="pano_' + index + '">' +
    '    <view hlookat="' + pano.yaw.toFixed(2) + '" vlookat="0" fov="90" fovmin="30" fovmax="120" />' +
    '    <preview url="" />' +
    '    <image>' +
    '      <sphere url="' + imgPath + '" />' +
    '    </image>' +
    '    ' + hotspotsXML +
    '\n  </scene>' +
    '  <!-- Встроенный мини-скин: кнопки управления -->' +
    '  <style name="skin_btn" type="text" css="color:#fff;font-size:14px;font-weight:bold;" padding="6" bgcolor="0x0f3460" bgalpha="0.8" rounded="4" />' +
    '  <layer name="skin_bg" keep="true" type="container" align="leftbottom" x="10" y="10" width="180" height="40" bgcolor="0x000000" bgalpha="0.5" rounded="6" />' +
    '  <layer name="btn_left"  keep="true" style="skin_btn" html="&#9664;"  align="leftbottom"  x="16"  y="16" width="30" height="28" onclick="set(view.hlookat, get(view.hlookat)-30);" />' +
    '  <layer name="btn_right" keep="true" style="skin_btn" html="&#9654;"  align="leftbottom"  x="50"  y="16" width="30" height="28" onclick="set(view.hlookat, get(view.hlookat)+30);" />' +
    '  <layer name="btn_up"    keep="true" style="skin_btn" html="&#9650;"  align="leftbottom"  x="84"  y="16" width="30" height="28" onclick="set(view.vlookat, get(view.vlookat)+15);" />' +
    '  <layer name="btn_down"  keep="true" style="skin_btn" html="&#9660;"  align="leftbottom"  x="118" y="16" width="30" height="28" onclick="set(view.vlookat, get(view.vlookat)-15);" />' +
    '  <layer name="btn_zoom_in"  keep="true" style="skin_btn" html="+" align="leftbottom" x="152" y="16" width="16" height="28" onclick="set(view.fov, get(view.fov)-10);" />' +
    '  <layer name="btn_zoom_out" keep="true" style="skin_btn" html="-" align="leftbottom" x="170" y="16" width="16" height="28" onclick="set(view.fov, get(view.fov)+10);" />' +
    '  <events onloadcomplete="setup_view();" />' +
    '</krpano>';

  return xml;
}

/* ---- Поиск ближайших панорам ---- */
function findNearest(index, count) {
  var pano = PANORAMAS[index];
  var results = [];

  for (var i = 0; i < PANORAMAS.length; i++) {
    if (i === index) continue;
    var dx = PANORAMAS[i].x - pano.x;
    var dy = PANORAMAS[i].y - pano.y;
    var dz = (PANORAMAS[i].z || 0) - (pano.z || 0);
    var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    results.push({ index: i, dist: dist });
  }

  results.sort(function(a, b) { return a.dist - b.dist; });
  return results.slice(0, count);
}

/* ---- Азимут от точки A к точке B ---- */
function azimuth(ax, ay, bx, by) {
  var dx = bx - ax;
  var dy = by - ay;
  var angle = Math.atan2(dx, dy) * 180 / Math.PI;
  // В krpano: 0 = север (вперёд), 90 = восток (вправо)
  // Lixel: X = восток, Y = север → atan2(dx, dy) даёт азимут
  if (angle < 0) angle += 360;
  return angle;
}

/* ---- Навигация: Назад / Вперёд ---- */
function navigatePrev() {
  if (historyIndex > 0) {
    historyIndex--;
    var idx = history[historyIndex];
    // Прямая загрузка без записи в историю
    currentIndex = idx;
    var pano = PANORAMAS[idx];
    document.getElementById("cur-filename").textContent = pano.filename;
    document.getElementById("cur-x").textContent = pano.x.toFixed(3);
    document.getElementById("cur-y").textContent = pano.y.toFixed(3);
    document.getElementById("cur-z").textContent = pano.z.toFixed(3);
    document.getElementById("cur-yaw").textContent = pano.yaw.toFixed(2) + "°";
    updateActiveItem();
    drawMinimap();
    updateDistances();
    updateNavButtons();
    var xml = buildSceneXML(idx);
    krpano.call("loadxml(" + escapeXML(xml) + ", null, null, BLEND(0.8));");
  }
}

function navigateNext() {
  // Вперёд = к ближайшей ещё не посещённой панораме
  var nearest = findNearest(currentIndex, NEAREST_COUNT + 1);
  for (var i = 0; i < nearest.length; i++) {
    if (history.indexOf(nearest[i].index) === -1 || nearest[i].index !== currentIndex) {
      if (nearest[i].index !== currentIndex) {
        loadPanoByIndex(nearest[i].index);
        return;
      }
    }
  }
  // Если все ближайшие уже посещены — просто к первой ближайшей
  if (nearest.length > 0 && nearest[0].index !== currentIndex) {
    loadPanoByIndex(nearest[0].index);
  }
}

/* ---- Кнопки навигации ---- */
function updateNavButtons() {
  document.getElementById("btn-prev").disabled = (historyIndex <= 0);
  var nearest = findNearest(currentIndex, 2);
  document.getElementById("btn-next").disabled = (nearest.length === 0);
}

/* ---- Список панорам ---- */
function renderPanoList() {
  var container = document.getElementById("pano-list");
  container.innerHTML = "";

  for (var i = 0; i < PANORAMAS.length; i++) {
    var pano = PANORAMAS[i];
    var item = document.createElement("div");
    item.className = "pano-item";
    item.id = "pano-item-" + i;
    item.onclick = (function(idx) {
      return function() { loadPanoByIndex(idx); };
    })(i);

    var filenameDiv = document.createElement("div");
    filenameDiv.className = "filename";
    filenameDiv.textContent = pano.filename;

    var coordsDiv = document.createElement("div");
    coordsDiv.className = "coords";
    coordsDiv.id = "coords-" + i;
    coordsDiv.textContent = "X:" + pano.x.toFixed(2) + " Y:" + pano.y.toFixed(2) + " Z:" + (pano.z || 0).toFixed(2);

    item.appendChild(filenameDiv);
    item.appendChild(coordsDiv);
    container.appendChild(item);
  }
}

function updateActiveItem() {
  var items = document.querySelectorAll(".pano-item");
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove("active");
  }
  var active = document.getElementById("pano-item-" + currentIndex);
  if (active) {
    active.classList.add("active");
    active.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function updateDistances() {
  var pano = PANORAMAS[currentIndex];
  for (var i = 0; i < PANORAMAS.length; i++) {
    if (i === currentIndex) continue;
    var dx = PANORAMAS[i].x - pano.x;
    var dy = PANORAMAS[i].y - pano.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    var el = document.getElementById("coords-" + i);
    if (el) {
      var p = PANORAMAS[i];
      el.innerHTML = "X:" + p.x.toFixed(2) + " Y:" + p.y.toFixed(2) + " Z:" + (p.z || 0).toFixed(2) +
        ' <span class="dist">' + dist.toFixed(1) + " м</span>";
    }
  }
  // Текущая — без расстояния
  var curEl = document.getElementById("coords-" + currentIndex);
  if (curEl) {
    var p = PANORAMAS[currentIndex];
    curEl.textContent = "X:" + p.x.toFixed(2) + " Y:" + p.y.toFixed(2) + " Z:" + (p.z || 0).toFixed(2) + " ← текущая";
  }
}

/* ---- Мини-карта ---- */
var mapBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

function computeBounds() {
  mapBounds.minX = Infinity; mapBounds.maxX = -Infinity;
  mapBounds.minY = Infinity; mapBounds.maxY = -Infinity;
  for (var i = 0; i < PANORAMAS.length; i++) {
    if (PANORAMAS[i].x < mapBounds.minX) mapBounds.minX = PANORAMAS[i].x;
    if (PANORAMAS[i].x > mapBounds.maxX) mapBounds.maxX = PANORAMAS[i].x;
    if (PANORAMAS[i].y < mapBounds.minY) mapBounds.minY = PANORAMAS[i].y;
    if (PANORAMAS[i].y > mapBounds.maxY) mapBounds.maxY = PANORAMAS[i].y;
  }
  var padX = (mapBounds.maxX - mapBounds.minX) * 0.1 || 5;
  var padY = (mapBounds.maxY - mapBounds.minY) * 0.1 || 5;
  mapBounds.minX -= padX; mapBounds.maxX += padX;
  mapBounds.minY -= padY; mapBounds.maxY += padY;
}

function drawMinimap() {
  var canvas = document.getElementById("minimap");
  var ctx = canvas.getContext("2d");
  var w = canvas.width, h = canvas.height;

  ctx.fillStyle = "#0d1b2a";
  ctx.fillRect(0, 0, w, h);

  if (PANORAMAS.length === 0) return;

  var rangeX = mapBounds.maxX - mapBounds.minX;
  var rangeY = mapBounds.maxY - mapBounds.minY;
  if (rangeX === 0) rangeX = 1;
  if (rangeY === 0) rangeY = 1;

  // Масштаб с сохранением пропорций
  var scale = Math.min(w / rangeX, h / rangeY);
  var offsetX = (w - rangeX * scale) / 2;
  var offsetY = (h - rangeY * scale) / 2;

  function toCanvas(x, y) {
    return {
      cx: offsetX + (x - mapBounds.minX) * scale,
      cy: h - offsetY - (y - mapBounds.minY) * scale
    };
  }

  // Линии связей к ближайшим
  var nearest = findNearest(currentIndex, NEAREST_COUNT);
  ctx.strokeStyle = "rgba(233,69,96,0.25)";
  ctx.lineWidth = 1;
  for (var i = 0; i < nearest.length; i++) {
    var a = toCanvas(PANORAMAS[currentIndex].x, PANORAMAS[currentIndex].y);
    var b = toCanvas(PANORAMAS[nearest[i].index].x, PANORAMAS[nearest[i].index].y);
    ctx.beginPath();
    ctx.moveTo(a.cx, a.cy);
    ctx.lineTo(b.cx, b.cy);
    ctx.stroke();
  }

  // Все точки
  for (var i = 0; i < PANORAMAS.length; i++) {
    var p = toCanvas(PANORAMAS[i].x, PANORAMAS[i].y);
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, i === currentIndex ? 5 : 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = i === currentIndex ? "#e94560" : "#533483";
    ctx.fill();
    if (i === currentIndex) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

/* Клик по мини-карте → ближайшая панорама */
document.addEventListener("DOMContentLoaded", function() {
  var canvas = document.getElementById("minimap");
  if (canvas) {
    canvas.addEventListener("click", function(e) {
      if (PANORAMAS.length === 0) return;
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;

      var w = canvas.width, h = canvas.height;
      var rangeX = mapBounds.maxX - mapBounds.minX;
      var rangeY = mapBounds.maxY - mapBounds.minY;
      if (rangeX === 0) rangeX = 1;
      if (rangeY === 0) rangeY = 1;
      var scale = Math.min(w / rangeX, h / rangeY);
      var offsetX = (w - rangeX * scale) / 2;
      var offsetY = (h - rangeY * scale) / 2;

      // Обратное преобразование
      var wx = (mx - offsetX) / scale + mapBounds.minX;
      var wy = (h - my - offsetY) / scale + mapBounds.minY;

      // Ищем ближайшую точку к клику
      var best = -1, bestDist = Infinity;
      for (var i = 0; i < PANORAMAS.length; i++) {
        var dx = PANORAMAS[i].x - wx;
        var dy = PANORAMAS[i].y - wy;
        var d = dx*dx + dy*dy;
        if (d < bestDist) { bestDist = d; best = i; }
      }
      if (best >= 0) loadPanoByIndex(best);
    });
  }
});

/* ---- Утилиты ---- */
function escapeXML(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
}

function showStatus(msg) {
  var el = document.getElementById("status");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(function() { el.style.display = "none"; }, 3000);
}
