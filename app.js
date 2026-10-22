let currentProject = null;
let currentScene = null;
let krpanoInstance = null;

// Переменные OpenLayers
let map = null;
let activeMarkerOverlay = null;
let arrowElement = null;
let markerVectorSource = null;
let wmsLayer = null;

// Переменные DOM лоадеров
let panoLoaderEl = null;
let progressBarFill = null;
let progressTextEl = null;

// Коэффициент перевода метров из локальной матрицы в градусы на карте (для референсной привязки)
const METERS_TO_DEGREES = 0.000009; 
const MAP_BUFFER_METERS = 100; // Буферная зона ограничений карты в метрах

document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initModal();
    initOpenLayers();
    initKrpano();
    initPanoLoaderElements();
    loadProjectsData();
});

function initTabs() {
    document.getElementById("mode-pano-btn").addEventListener("click", () => switchToView("pano"));
    document.getElementById("mode-map-btn").addEventListener("click", () => switchToView("map"));
}

function switchToView(mode) {
    const viewPano = document.getElementById("pano-viewer");
    const viewMap = document.getElementById("map-viewer");
    const btnPano = document.getElementById("mode-pano-btn");
    const btnMap = document.getElementById("mode-map-btn");

    if (mode === "pano") {
        btnPano.classList.add("active"); btnMap.classList.remove("active");
        viewPano.classList.add("active"); viewMap.classList.remove("active");
    } else {
        btnMap.classList.add("active"); btnPano.classList.remove("active");
        viewMap.classList.add("active"); viewPano.classList.remove("active");
        if (map && currentProject) {
            map.updateSize();
            syncMapPosition();
        }
    }
}

function initModal() {
    const overlay = document.getElementById("project-modal-overlay");
    document.getElementById("open-project-btn").addEventListener("click", () => overlay.style.display = "flex");
    document.getElementById("close-modal-btn").addEventListener("click", () => overlay.style.display = "none");
    document.getElementById("filter-region").addEventListener("change", renderProjectsList);
}

function initPanoLoaderElements() {
    panoLoaderEl = document.getElementById('pano-loader');
    progressBarFill = document.getElementById('progress-bar-fill');
    progressTextEl = document.getElementById('progress-text');
}

async function loadProjectsData() {
    try {
        const response = await fetch('projects.json');
        window.projectsList = await response.json();
        renderProjectsList();
    } catch (error) {
        console.error("Ошибка загрузки projects.json:", error);
    }
}

function renderProjectsList() {
    const container = document.getElementById("project-list-container");
    const filterVal = document.getElementById("filter-region").value;
    container.innerHTML = "";
    if (!window.projectsList) return;

    window.projectsList.filter(p => filterVal === "all" || p.region === filterVal).forEach(proj => {
        const item = document.createElement("div");
        item.className = "project-item";
        item.innerHTML = `<div class="title">${proj.title}</div><div class="meta">Панорам: ${proj.scenes.length}</div>`;
        item.addEventListener("click", () => {
            selectProject(proj);
            document.getElementById("project-modal-overlay").style.display = "none";
        });
        container.appendChild(item);
    });
}

function getPositionFromMatrix(matrix) {
    return { x: matrix[12], y: matrix[13], z: matrix[14] }; // Извлечение смещений X, Y, Z (Column-Major)
}

function selectProject(project) {
    currentProject = project;
    document.getElementById('map-loader').style.display = 'flex';

    if (wmsLayer) {
        wmsLayer.getSource().setUrl(project.geoserver_wms_url);
        wmsLayer.getSource().updateParams({ 'LAYERS': project.wms_layer_name });
    }

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

    project.scenes.forEach(scene => {
        const pos = getPositionFromMatrix(scene.matrix);
        scene.lon = project.base_lon + (pos.x * METERS_TO_DEGREES);
        scene.lat = project.base_lat + (pos.z * METERS_TO_DEGREES);

        if (scene.lon < minLon) minLon = scene.lon;
        if (scene.lon > maxLon) maxLon = scene.lon;
        if (scene.lat < minLat) minLat = scene.lat;
        if (scene.lat > maxLat) maxLat = scene.lat;
    });

    const panel = document.getElementById("scene-selector-panel");
    panel.innerHTML = "";
    project.scenes.forEach(scene => {
        const thumb = document.createElement("div");
        thumb.className = "scene-thumb"; thumb.id = `thumb-${scene.id}`; thumb.innerText = scene.title;
        thumb.addEventListener("click", () => {
            if (krpanoInstance) krpanoInstance.call(`loadscene(${scene.id}, null, MERGE);`);
        });
        panel.appendChild(thumb);
    });

    generateKrpanoProjectXML(project);
    renderProjectMarkersOnMap(project);

    if (project.scenes.length > 0 && map) {
        const minCorner = ol.proj.fromLonLat([minLon, minLat]);
        const maxCorner = ol.proj.fromLonLat([maxLon, maxLat]);
        
        const restrictedExtent = [
            minCorner[0] - MAP_BUFFER_METERS, minCorner[1] - MAP_BUFFER_METERS,
            maxCorner[0] + MAP_BUFFER_METERS, maxCorner[1] + MAP_BUFFER_METERS
        ];

        map.setView(new ol.View({
            extent: restrictedExtent,
            center: [(restrictedExtent[0] + restrictedExtent[2]) / 2, (restrictedExtent[1] + restrictedExtent[3]) / 2],
            zoom: 17, minZoom: 12, maxZoom: 21
        }));

        map.getView().fit(restrictedExtent, { size: map.getSize(), padding: [50, 50, 50, 50] });
    }

    if (project.scenes.length > 0 && krpanoInstance) {
        krpanoInstance.call(`loadscene(${project.scenes[0].id}, null, MERGE);`);
    }
}

function generateKrpanoProjectXML(project) {
    if (!krpanoInstance) return;
    let xmlString = "";

    project.scenes.forEach(current => {
        xmlString += `<scene name="${current.id}" title="${current.title}">`;
        xmlString += `<view hlookat="0.0" vlookat="0.0" fov="90.0" />`;

        if (current.imageType === "cube") {
            xmlString += `<image><cube url="${current.url}" /></image>`;
        } else {
            xmlString += `<image><sphere url="${current.url}" /></image>`;
        }

        const currentPos = getPositionFromMatrix(current.matrix);
        project.scenes.forEach(other => {
            if (current.id !== other.id) {
                const otherPos = getPositionFromMatrix(other.matrix);
                const dx = otherPos.x - currentPos.x;
                const dz = otherPos.z - currentPos.z;
                if (Math.sqrt(dx*dx + dz*dz) < 200) {
                    let ath = Math.atan2(dx, dz) * (180 / Math.PI);
                    xmlString += `<hotspot name="to_${other.id}" ath="${ath.toFixed(2)}" atv="0.0" style="skin_hotspotstyle" onclick="loadscene(${other.id}, null, MERGE);" />`;
                }
            }
        });
        xmlString += `</scene>`;
    });
    krpanoInstance.call("loadxml(" + escape(xmlString) + ", null, MERGE);");
}

window.onKrpanoSceneChanged = function(sceneId) {
    if (!currentProject) return;
    const targetScene = currentProject.scenes.find(s => s.id === sceneId);
    if (targetScene) {
        currentScene = targetScene;
        document.querySelectorAll(".scene-thumb").forEach(el => el.classList.remove("active"));
        const activeThumb = document.getElementById(`thumb-${sceneId}`);
        if (activeThumb) activeThumb.classList.add("active");
        syncMapPosition();
    }
};

window.onKrpanoViewChanged = function(hlookat) {
    if (arrowElement) arrowElement.style.transform = `rotate(${hlookat}deg)`;
};

window.onPanoLoadStart = function() {
    if (panoLoaderEl) panoLoaderEl.style.display = 'flex';
    if (progressBarFill) progressBarFill.style.width = '0%';
    if (progressTextEl) progressTextEl.innerText = '0%';
};

window.onPanoLoading = function(progressValue) {
    const percentage = Math.round(progressValue * 100);
    if (panoLoaderEl && percentage < 100) panoLoaderEl.style.display = 'flex';
    if (progressBarFill) progressBarFill.style.width = `${percentage}%`;
    if (progressTextEl) progressTextEl.innerText = `${percentage}%`;
};

window.onPanoLoadComplete = function() {
    if (progressBarFill) progressBarFill.style.width = '100%';
    if (progressTextEl) progressTextEl.innerText = '100%';
    setTimeout(() => { if (panoLoaderEl) panoLoaderEl.style.display = 'none'; }, 200);
};

function initOpenLayers() {
    const markerContainer = document.createElement('div');
    markerContainer.className = 'view-marker-container';
    arrowElement = document.createElement('div'); arrowElement.className = 'view-arrow';
    const dotElement = document.createElement('div'); dotElement.className = 'view-center-dot';
    markerContainer.appendChild(arrowElement); markerContainer.appendChild(dotElement);

    activeMarkerOverlay = new ol.Overlay({ element: markerContainer, positioning: 'center-center', stopEvent: false });
    markerVectorSource = new ol.source.Vector();
    
    const markerVectorLayer = new ol.layer.Vector({
        source: markerVectorSource,
        style: new ol.style.Style({
            image: new ol.style.Circle({
                radius: 7, fill: new ol.style.Fill({ color: '#0078ff' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            })
        })
    });

    const wmsSource = new ol.source.TileWMS({
        url: 'about:blank', params: { 'TILED': true, 'VERSION': '1.1.1' }, serverType: 'geoserver'
    });

    const loaderEl = document.getElementById('map-loader');
    wmsSource.on('tileloadstart', () => loaderEl.style.display = 'flex');
    wmsSource.on(['tileloadend', 'tileloaderror'], () => loaderEl.style.display = 'none');

    wmsLayer = new ol.layer.Tile({ source: wmsSource });
    const scaleLineControl = new ol.control.ScaleLine({ units: 'metric' });

    map = new ol.Map({
        target: 'map-div',
        layers: [wmsLayer, markerVectorLayer],
        controls: ol.control.defaults.defaults().extend([scaleLineControl]),
        view: new ol.View({ center: ol.proj.fromLonLat([37.6173, 55.7558]), zoom: 16 }),
        overlays: [activeMarkerOverlay]
    });

    map.on('click', (event) => {
        const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f);
        if (feature) {
            const clickedSceneId = feature.get('sceneId');
            if (clickedSceneId && krpanoInstance) {
                krpanoInstance.call(`loadscene(${clickedSceneId}, null, MERGE);`);
                switchToView("pano");
            }
        }
    });

    map.on('pointermove', (e) => {
        const pixel = map.getEventPixel(e.originalEvent);
        map.getTargetElement().style.cursor = map.hasFeatureAtPixel(pixel) ? 'pointer' : '';
    });
}

function renderProjectMarkersOnMap(project) {
    if (!markerVectorSource) return;
    markerVectorSource.clear();
    project.scenes.forEach(scene => {
        const coords = ol.proj.fromLonLat([scene.lon, scene.lat]);
        const feature = new ol.Feature({ geometry: new ol.geom.Point(coords) });
        feature.set('sceneId', scene.id);
        markerVectorSource.addFeature(feature);
    });
}

function syncMapPosition() {
    if (!map || !currentScene || !activeMarkerOverlay) return;
    const coordinates = ol.proj.fromLonLat([currentScene.lon, currentScene.lat]);
    activeMarkerOverlay.setPosition(coordinates);
    map.getView().animate({ center: coordinates, duration: 400 });
}

function initKrpano() {
    embedkrpano({
        xml: "tour.xml", target: "krpano-div", html5: "auto",
        onready: function(instance) { krpanoInstance = instance; }
    });
}