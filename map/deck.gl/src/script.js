/*
* https://deck.gl/docs/api-reference/aggregation-layers/heatmap-layer#source
*/
const {DeckGL, HeatmapLayer} = deck;

const layer = new HeatmapLayer({
  id: 'HeatmapLayer',
  data: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/sf-bike-parking.json',
  
  /* props from HeatmapLayer class */
  
  // aggregation: 'SUM',
  // colorDomain: null,
  // colorRange: [[255, 255, 178], [254, 217, 118], [254, 178, 76], [253, 141, 60], [240, 59, 32], [189, 0, 38]],
  // debounceTimeout: 500,
  getPosition: d => d.COORDINATES,
  getWeight: d => d.SPACES,
  // intensity: 1,
  radiusPixels: 25,
  // threshold: 0.05,
  // weightsTextureSize: 2048,
  
  /* props inherited from Layer class */
  
  // autoHighlight: false,
  // coordinateOrigin: [0, 0, 0],
  // coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
  // highlightColor: [0, 0, 128, 128],
  // modelMatrix: null,
  // opacity: 1,
  // pickable: false,
  // visible: true,
  // wrapLongitude: false,
});

new DeckGL({
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  initialViewState: {
    longitude: -114.130731,
    latitude: 51.011812,
    zoom: 15.5,
    pitch: 0,
    bearing: 0
  },
  controller: true,
  
  layers: [layer]
});
  