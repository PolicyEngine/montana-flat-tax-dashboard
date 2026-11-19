'use client';

// The Montana map is rendered from the bundled
// congressional_districts.geojson with no browser-only deps, so we
// re-export the SVG choropleth component directly.
export { default } from './USDistrictChoroplethMap';
export type { MTDistrictData } from './USDistrictChoroplethMap';
