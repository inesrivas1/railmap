import { Map, setWorkerUrl } from 'maplibre-gl'
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
    data: '/data/StopsGB.geojson'
  });


  map.addLayer({
    'id': 'stations',
    'type': 'circle',
    'source': 'stations',
    'paint': {
      'circle-radius': 3,
      'circle-color': '#cc1e1e'
    },
    'filter': [
      'all',
      ['==', ['get', 'Closing'], 'still open'],
    ]
  });
});

