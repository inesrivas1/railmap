import { Map, Popup, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'
import { geoDistance, trackDistance } from './route.js'

const STATION_RADIUS_MIN = 5;
const STATION_RADIUS_MAX = 7;

// Vite worker setup
setWorkerUrl(workerUrl)

const map = new Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: [-3.5, 55.8],
  zoom: 5,
  minZoom: 4.8,
  maxBounds: [[-26, 45], [19, 65]]
});

map.addControl(new NavigationControl({ showCompass: false }));
map.addControl(new ScaleControl({ unit: 'metric' }))


map.on('load', async () => {

  // Hide prexising layers of rail that come with the map
  for (const layer of map.getStyle().layers) {
    if (layer.id.includes('rail'))
      map.removeLayer(layer.id)
  }

  const response = await fetch(`${import.meta.env.BASE_URL}data/graph-stations.geojson`);
  const stationsGeojson = await response.json();


  // ------------------------------------------------------------------------------------
  // ------------------------------------------------------------------------------------
  //                                          SOURCES 
  // ------------------------------------------------------------------------------------
  // ------------------------------------------------------------------------------------


  map.addSource('graph-stations', {
    type: 'geojson',
    data: stationsGeojson,
    attribution: '<a href=https://bl.iro.bl.uk/entities/product/56ff09f0-db5b-4ca9-8389-cfa362d5f46b>StopsGB</a>',
    cluster: true,
    clusterRadius: 14,
    clusterMaxZoom: 11,
  });

  map.addSource('graph-edges', {
    type: 'geojson',
    data: `${import.meta.env.BASE_URL}data/graph-edges.geojson`,
    attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });

  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  // ------------------------------------------------------------------------------------
  // ------------------------------------------------------------------------------------
  //                                          LAYERS 
  // ------------------------------------------------------------------------------------
  // ------------------------------------------------------------------------------------

  map.addLayer({
    'id': 'railways',
    'type': 'line',
    'source': 'graph-edges',
    'paint': {
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        5, 0.5,
        10, 2,
        15, 7
      ],
      'line-color': '#2b2b2b',
      'line-opacity': 0.9
    },
  });

  /** Layer for the track route between two stations */
  map.addLayer({
    'id': 'route',
    'type': 'line',
    'source': 'route',
    'paint': {
      'line-color': '#e8590c',
      'line-width': 5,
      'line-opacity': 0.8
    }
  });

  /** Layer of point clusters: https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/ */
  map.addLayer({
    'id': 'clusters',
    'type': 'circle',
    'source': 'graph-stations',
    'filter': ['has', 'point_count'],
    'paint': {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        5, ['*', STATION_RADIUS_MIN, ['^', ['get', 'point_count'], 0.4]],
        11, ['*', STATION_RADIUS_MAX, ['^', ['get', 'point_count'], 0.4]]
      ],
      'circle-color': '#1b4f9c',
      'circle-opacity': 0.3,
      'circle-stroke-color': '#1b4f9c',
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.9
    },
  });



  /** Layer that helps display cluster count */
  map.addLayer({
    'id': 'cluster-count',
    'type': 'symbol',
    'source': 'graph-stations',
    'filter': ['has', 'point_count'],
    'layout': {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Noto Sans Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        5, 10,
        10, 15,
        15, 20
      ],
    },
    'paint': {
      'text-color': '#1b4f9c',
    }
  });

  /** Layer to display single stations */
  map.addLayer({
    'id': 'unclustered-point',
    'type': 'circle',
    'source': 'graph-stations',
    'filter': ['!', ['has', 'point_count']],
    'paint': {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        5, STATION_RADIUS_MIN,
        11, STATION_RADIUS_MAX
      ],
      'circle-color': '#1b4f9c',
      'circle-opacity': 0.3,
      'circle-stroke-color': '#1b4f9c',
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.9
    },
  });


  // ------------------------------------------------------------------------------------
  // ------------------------------------------------------------------------------------
  //                                     INTERACTIVITY
  // ------------------------------------------------------------------------------------
  // ------------------------------------------------------------------------------------


  map.on('click', 'clusters', async (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['clusters']
    });
    const clusterId = features[0].properties.cluster_id;
    const zoom = await map.getSource('graph-stations').getClusterExpansionZoom(clusterId);
    map.easeTo({
      center: features[0].geometry.coordinates,
      zoom
    });
  });

  const popup = new Popup({
    className: 'station-popup',
    offset: 10,
    closeButton: false,
    closeOnClick: false
  })

  /**https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/ */
  let currentFeatureCoordinates = undefined;

  map.on('mousemove', 'unclustered-point', (e) => {
    const featureCoordinates = e.features[0].geometry.coordinates.toString();
    if (currentFeatureCoordinates !== featureCoordinates) {
      currentFeatureCoordinates = featureCoordinates;

      map.getCanvas().style.cursor = 'pointer';

      const coordinates = e.features[0].geometry.coordinates.slice();
      const properties = e.features[0].properties;
      const description = `
        <span class="station-name">${properties.Station.toLowerCase()}</span>
        <div class="station-details">
          Opened: ${properties.Opening}<br>
          Track: ${properties.track_name ?? 'unnamed'}<br>
        </div>`;

      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      popup.setLngLat(coordinates).setHTML(description).addTo(map);
    }
  });


  map.on('mouseleave', 'unclustered-point', () => {
    currentFeatureCoordinates = undefined;
    map.getCanvas().style.cursor = '';
    popup.remove();
  });


  const distancesResponse = await fetch(`${import.meta.env.BASE_URL}data/track-distances.json`);
  const distances = await distancesResponse.json();

  const positions = {};
  for (const feature of stationsGeojson.features) {
    positions[feature.properties.StationId] = feature.geometry.coordinates;
  }

  let picked = [];

  map.on('click', 'unclustered-point', (e) => {
    const fromBox = document.getElementById('from');
    const toBox = document.getElementById('to');
    const geoBox = document.getElementById('geographic');
    const trackBox = document.getElementById('track');
    const station = e.features[0];

    picked.push(station);
    if (picked.length > 2) {
      picked = [station];
    }

    const firstName = picked[0].properties.Station.toLowerCase();

    if (picked.length === 1) {
      fromBox.textContent = firstName;
      toBox.textContent = '';
      geoBox.textContent = '';
      trackBox.textContent = '';
      map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
    }

    if (picked.length === 2) {
      const secondName = picked[1].properties.Station.toLowerCase();
      toBox.textContent = secondName;
      const geographic = geoDistance(picked[0].geometry.coordinates, picked[1].geometry.coordinates);

      const start = String(picked[0].properties.StationId);
      const end = String(picked[1].properties.StationId);
      const track = trackDistance(distances, start, end);

      let trackText = 'no rail route';
      if (track !== null) {
        trackText = `${(track.distance / 1000).toFixed(1)} km`;

        const coordinates = [];
        for (const stationId of track.route) {
          coordinates.push(positions[stationId]);
        }
        map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coordinates } });
      }

      geoBox.textContent = `${geographic.toFixed(1)} km`;
      trackBox.textContent = trackText;
    }
  });


  document.getElementById('geo-button').addEventListener('click', async () => {
    await map.getSource('graph-stations').setClusterOptions({ cluster: true });
    map.getSource('graph-stations').setData(stationsGeojson);
  });

  document.getElementById('track-button').addEventListener('click', async () => {
    await map.getSource('graph-stations').setClusterOptions({ cluster: false });
    map.getSource('graph-stations').setData(stationsGeojson);
  });

})