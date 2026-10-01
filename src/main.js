import { Map, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

// Vite worker setup
setWorkerUrl(workerUrl)

new Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-3.5, 54.5],
  zoom: 5,
})