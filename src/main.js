import { Map, Popup, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

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

map.addControl(new NavigationControl({showCompass : false}));
map.addControl(new ScaleControl({ unit: 'metric' }))


map.on('load', () => {
  for (const layer of map.getStyle().layers) {
    if (layer.id.includes('rail'))
      map.removeLayer(layer.id)
  }

  map.addSource('graph-stations', {
    type: 'geojson',
    data: `${import.meta.env.BASE_URL}data/graph-stations.geojson`,
    attribution: '<a href=https://bl.iro.bl.uk/entities/product/56ff09f0-db5b-4ca9-8389-cfa362d5f46b>StopsGB</a>',
    cluster: true,
    clusterRadius: 14,
    clusterMaxZoom: 11,
  });

  map.addSource('graph-edges', {
    type: 'geojson',
    data: `${import.meta.env.BASE_URL}data/graph-edges.geojson`,
    attribution: '<a href=https://data.humdata.org/dataset/hotosm_gbr_railways>OpenStreetMap</a>'
  });

  map.addSource('graph-nodes', {
    type: 'geojson',
    data: `${import.meta.env.BASE_URL}data/graph-nodes.geojson`
  });

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
  })

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

  map.on('click', 'clusters', async (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['clusters']
    });
    const clusterId = features[0].properties.cluster_id;
    const zoom = await map.getSource('stations').getClusterExpansionZoom(clusterId);
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
      const station = e.features[0].properties.Station.toLowerCase();
      const description = `<span class="station-name">${station}</span>`

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


})