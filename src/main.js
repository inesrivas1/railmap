import { Map, Popup, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

// Vite worker setup
setWorkerUrl(workerUrl)

const map = new Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: [-3.5, 54.5],
  zoom: 5,
});

map.on('load', () => {
  for (const layer of map.getStyle().layers) {
    if (layer.id.includes('rail'))
      map.removeLayer(layer.id)
  }

  map.addSource('stations', {
    type: 'geojson',
    data: `${import.meta.env.BASE_URL}data/StopsGB.geojson`,
    attribution: '<a href=https://bl.iro.bl.uk/entities/product/56ff09f0-db5b-4ca9-8389-cfa362d5f46b>StopsGB</a>',
    cluster: true,
    clusterRadius: 30,
    clusterMaxZoom: 11,
    filter: [
      'all',
      ['==', ['get', 'Closing'], 'still open'],
      ['==', ['get', 'ghost_entry'], 'False']
    ]
  });

  map.addSource('railways', {
    type: 'geojson',
    data: `${import.meta.env.BASE_URL}data/railways.geojson`,
    attribution: '<a href=https://data.humdata.org/dataset/hotosm_gbr_railways>OpenStreetMap</a>'
  });

  map.addLayer({
    'id': 'railways',
    'type': 'line',
    'source': 'railways',
    'paint': {
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        5, 0.5,
        10, 2,
        15, 7
      ],
      'line-color': '#4a4a4a',
      'line-opacity': 0.7
    },
  });

  /**https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/ */
  map.addLayer({
    'id': 'clusters',
    'type': 'circle',
    'source': 'stations',
    'filter': ['has', 'point_count'],
    'paint': {
      'circle-radius': [
        'step', ['get', 'point_count'],
        8,
        2, 10,
        3, 12,
        4, 14,
        5, 16,
        10, 20
      ],
      'circle-color': '#1b4f9c',
      'circle-opacity': 0.3,
      'circle-stroke-color': '#1b4f9c',
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.9
    },

  });

  map.addLayer({
    'id': 'cluster-count',
    'type': 'symbol',
    'source': 'stations',
    'filter': ['has', 'point_count'],
    'layout': {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Noto Sans Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        5, 8,
        10, 15,
        15, 20
      ],
    },
    'paint': {
      'text-color': '#1b4f9c'
    }
  })

  map.addLayer({
    'id': 'unclustered-point',
    'type': 'circle',
    'source': 'stations',
    'filter': ['!', ['has', 'point_count']],
    'paint': {
      'circle-radius': 7,
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
      const station = e.features[0].properties.Station;
      const description = `station name: ${station}`

      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      popup.setLngLat(coordinates).setHTML(description).addTo(map);
    }
  });


  map.on('mouseleave', 'unclustered-point', () => {
    currentFeatureCoordinates  = undefined;
    map.getCanvas().style.cursor = '';
    popup.remove();
  });


})