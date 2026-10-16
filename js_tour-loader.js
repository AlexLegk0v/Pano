let krpanoInstance = null;
let projectsList = []; 
let currentProject = null;
let activeSceneHeading = 0;
const MAX_DISTANCE_FOR_TRANSITION = 6.0; // Порог генерации стрелок в метрах

window.addEventListener("DOMContentLoaded", () => {
    embedpano({
        xml: null, target: "pano", html5: "only", passQueryParameters: true,
        onready: (interfaceObject) => {
            krpanoInstance = interfaceObject;
            loadMasterProjectsList();
        }
    });
});

// Переключатель вкладок на одной странице
function switchTab(tabName) {
    const panoTab = document.getElementById('tab-pano-content');
    const mapTab = document.getElementById('tab-map-content');
    const btnPano = document.getElementById('btn-tab-pano');
    const btnMap = document.getElementById('btn-tab-map');

    if (!panoTab || !mapTab || !btnPano || !btnMap) return;

    btnPano.classList.remove('active');
    btnMap.classList.remove('active');

    if (tabName === 'pano') {
        panoTab.style.zIndex = 2;
        mapTab.style.display = 'none';
        btnPano.classList.add('active');
    } else if (tabName === 'map') {
        panoTab.style.zIndex = 1;
        mapTab.style.display = 'block';
        btnMap.classList.add('active');
    }
}

// Загрузка перечня доступных сетевых конфигураций
async function loadMasterProjectsList() {
    try {
        const response = await fetch('js/projects-list.json');
        if (!response.ok) throw new Error(`HTTP status: ${response.status}`);
        const data = await response.json();
        projectsList = data.available_projects;
        populateProjectSelector();
    } catch (error) {
        console.error("Критическая ошибка инициализации мастер-списка:", error);
    }
}

function populateProjectSelector() {
    const selector = document.getElementById('project-selector');
    if (!selector) return;
    projectsList.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.title; selector.appendChild(opt);
    });
    selector.addEventListener('change', (e) => { 
        if (e.target.value) handleProjectDataFetch(e.target.value); 
    });
}

// Сетевой загрузчик и распределитель парсинга
async function handleProjectDataFetch(projectId) {
    const meta = projectsList.find(p => p.id === projectId);
    if (!meta) return;

    try {
        const response = await fetch(meta.config_url);
        if (!response.ok) throw new Error(`Код ошибки сети: ${response.status}`);
        
        let parsedPanoramas = [];

        if (meta.format === "json") {
            const json = await response.json();
            parsedPanoramas = json.panoramas;
        } else if (meta.format === "csv") {
            const csvText = await response.text();
            parsedPanoramas = parseCSVData(csvText);
        }

        currentProject = {
            id: meta.id,
            title: meta.title,
            type: "sphere",
            panoramas: parsedPanoramas
        };

        if (currentProject.panoramas.length > 0) {
            loadProjectTourEngine();
        } else {
            alert("Ошибка: Файл конфигурации пуст или распознан некорректно.");
        }

    } catch (error) {
        console.error(`Ошибка динамического доступа по пути: ${meta.config_url}`, error);
        alert(`Не удалось прочитать файл проекта. Проверьте права сетевого доступа.`);
    }
}

// Встроенный текстовый парсер CSV-матриц на чистом JS
function parseCSVData(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(separator).map(h => h.trim().toLowerCase());
    const panoramasList = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        if (!currentLine) continue; 
        
        const values = currentLine.split(separator).map(v => v.trim());
        const panoItem = {};

        headers.forEach((header, index) => {
            const rawValue = values[index];
            if (header === 'filename') {
                panoItem[header] = rawValue;
            } else {
                panoItem[header] = parseFloat(rawValue) || 0.0;
            }
        });

        if (panoItem.filename) panoramasList.push(panoItem);
    }
    return panoramasList;
}

// Кватернионы -> Углы Эйлера (Компенсация завала текстуры в WebGL)
function getYawFromQuaternion(qw, qx, qy, qz) {
    const siny_cosp = 2 * (qw * qz + qx * qy);
    const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
    return Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);
}
function getPitchFromQuaternion(qw, qx, qy, qz) {
    const sinp = 2 * (qw * qy - qz * qx);
    if (Math.abs(sinp) >= 1) return (Math.sign(sinp) * Math.PI / 2) * (180 / Math.PI);
    return Math.asin(sinp) * (180 / Math.PI);
}
function getRollFromQuaternion(qw, qx, qy, qz) {
    const sinr_cosp = 2 * (qw * qx + qy * qz);
    const cosr_cosp = 1 - 2 * (qx * qx + qy * qy);
    return Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI);
}

// Генератор XML структуры и загрузка в плеер
function loadProjectTourEngine() {
    if (!currentProject || !krpanoInstance) return;

    let xmlString = '<krpano>';
    xmlString += '<control usercontrol="mouse" mouseaccelerate="1.0" mousereduce="1.0" />';
    xmlString += '<keybkey mode="1" />';
    xmlString += '<textstyle name="hs_style" font="Arial" fontsize="13" bold="true" textcolor="0xFFFFFF" background="true" backgroundcolor="0x000000" backgroundalpha="0.7" border="false" roundedge="5" yoffset="-35" showtime="0.1" />';
    xmlString += '<events onxmlchanged="js(onPanoChanged();)" />';

    currentProject.panoramas.forEach((pano, index) => {
        const sceneName = "scene_" + pano.filename.replace(/[^a-zA-Z0-9]/g, '_');
        const rx_pitch = getPitchFromQuaternion(pano.qw, pano.qx, pano.qy, pano.qz);
        const ry_yaw   = getYawFromQuaternion(pano.qw, pano.qx, pano.qy, pano.qz);
        const rz_roll  = getRollFromQuaternion(pano.qw, pano.qx, pano.qy, pano.qz);

        xmlString += `<scene name="${sceneName}" title="Точка ${index + 1}">`;
        xmlString += `<view hlookat="0" vlookat="0" fov="90" />`;

        const prealignString = `${rx_pitch.toFixed(4)}|${ry_yaw.toFixed(4)}|${rz_roll.toFixed(4)}`;
        xmlString += `<image prealign="${prealignString}"><sphere url="${pano.filename}" /></image>`;

        // Авторасчет векторов связей в 3D
        currentProject.panoramas.forEach((otherPano, otherIndex) => {
            if (index === otherIndex) return;
            const dx = otherPano.x - pano.x; const dy = otherPano.y - pano.y; const dz = otherPano.z - pano.z;
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

            if (distance <= MAX_DISTANCE_FOR_TRANSITION) {
                const targetSceneName = "scene_" + otherPano.filename.replace(/[^a-zA-Z0-9]/g, '_');
                let ath = Math.atan2(dx, dy) * (180 / Math.PI); 
                const horizontalDistance = Math.sqrt(dx*dx + dy*dy);
                let atv = -Math.atan2(dz, horizontalDistance) * (180 / Math.PI);

                xmlString += `<hotspot name="to_${targetSceneName}" url="skin/vtourskin_hotspot.png" ath="${ath.toFixed(2)}" atv="${atv.toFixed(2)}" scale="0.5" distorted="true" onhover="showtext('Перейти к точке ${otherIndex + 1} (${distance.toFixed(1)}м)', hs_style);" onclick="loadscene(${targetSceneName}, null, MERGE, BLEND(0.4));" />`;
            }
        });
        xmlString += '</scene>';
    });
    xmlString += '</krpano>';

    build2DMapLayer(currentProject);

    krpanoInstance.call("loadxml(" + escape(xmlString) + ", null, MERGE);");
    const firstSceneName = "scene_" + currentProject.panoramas[0].filename.replace(/[^a-zA-Z0-9]/g, '_');
    krpanoInstance.call(`loadscene(${firstSceneName}, null, MERGE, BLEND(0.4));`);

    trackRadarFrameCycle();
}

// Отрисовка координатной карты
function build2DMapLayer(project) {
    const pointsDiv = document.getElementById('map-points');
    if (!pointsDiv) return;
    pointsDiv.innerHTML = ''; 

    const xs = project.panoramas.map(p => p.x);
    const ys = project.panoramas.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const deltaX = (maxX - minX) || 1;
    const deltaY = (maxY - minY) || 1;

    project.panoramas.forEach((pano, index) => {
        const sceneName = "scene_" + pano.filename.replace(/[^a-zA-Z0-9]/g, '_');
        const leftPercent = 10 + ((pano.x - minX) / deltaX) * 80;
        const topPercent = 10 + (1 - (pano.y - minY) / deltaY) * 80;

        const dot = document.createElement('div');
        dot.className = 'map-dot';
        dot.id = `dot_${sceneName}`;
        dot.style.left = `${leftPercent}%`;
        dot.style.top = `${topPercent}%`;
        dot.title = `Точка ${index + 1}: ${pano.filename}\nКоординаты: X:${pano.x}, Y:${pano.y}, Z:${pano.z}`;

        dot.addEventListener('click', () => {
            switchTab('pano'); // Возврат на панораму при клике по карте
            if (krpanoInstance) krpanoInstance.call(`loadscene(${sceneName}, null, MERGE, BLEND(0.4));`);
        });

        pointsDiv.appendChild(dot);
    });

    const radar = document.createElement('div');
    radar.id = 'map-radar';
    pointsDiv.appendChild(radar);
}

// Синхронизация состояний при переходе
function onPanoChanged() {
    if (!krpanoInstance) return;
    const currentScene = krpanoInstance.get("xml.scene");
    const prealignData = krpanoInstance.get(`scene[\${currentScene}].prealign`);
    activeSceneHeading = prealignData ? Number(prealignData.split('|')[1]) : 0;
    
    document.querySelectorAll('.map-dot').forEach(d => d.classList.remove('active'));
    
    const activeDot = document.getElementById(`dot_\${currentScene}`);
    const radar = document.getElementById('map-radar');
    
    if (activeDot && radar) {
        activeDot.classList.add('active');
        radar.style.left = activeDot.style.left;
        radar.style.top = activeDot.style.top;
        radar.style.display = 'block';
    }
}

// Высокопроизводительный трекинг направления взгляда в HTML5-слое (60 FPS)
function trackRadarFrameCycle() {
    const radar = document.getElementById('map-radar');
    if (radar && krpanoInstance) {
        let viewHlookat = krpanoInstance.get("view.hlookat");
        let totalRotation = Number(viewHlookat) + activeSceneHeading;
        radar.style.transform = `translate(-50%, -50%) rotate(\${-totalRotation - 90}deg)`;
    }
    requestAnimationFrame(trackRadarFrameCycle);
}