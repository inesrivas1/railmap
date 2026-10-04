import {Map, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

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

  map.addLayer({
    'id': 'stations',
    'type': 'circle',
    'source': 'stations',
    'paint': {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        5, 6,
        10, 15,
        15, 20
      ],
      'circle-color': '#1b4f9c',
      'circle-opacity': 0.3,
      'circle-stroke-color': '#1b4f9c',
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.9
    },

  });

  map.addLayer({
    'id': 'station-count',
    'type': 'symbol',
    'source': 'stations',
    'layout': {
      'text-field': '1',
      'text-font': ['Bold'],
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

});

