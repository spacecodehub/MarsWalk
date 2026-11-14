# MarsWalk

An astronaut's journey from Earth to Mars with an interactive 3D Martian map.
NASA Space Apps Challenge 2026 - Interplanetary Survival Guide: Martian Map.

## Team
- Add your names here

## Run locally
npm install
npm run dev

## 2D Mars terrain map

The web app displays a global MOLA elevation map with Jezero Crater marked. It
does not require QGIS. The display PNG is generated from the MOLA topography
product `MEGT90N000EB.IMG`; the similarly named `MEGA90N000EB.IMG` is the
areoid reference surface, not the terrain raster used for the map.

To regenerate the display image, place the topography `.img`, `.hdr`, and PDS
`.lbl` files in `GIS/raw_data/MOLA_MEgdr16ppd/`, then run:

```sh
python GIS/scripts/render_mola_map.py
```

The script validates the raster layout, treats the ENVI header's ignore value
as NoData, and writes `public/mars-mola-elevation.png` plus a JSON provenance
file.
The source raster is ignored by Git; the generated image is small enough to
serve with the app. MOLA is global context at about 3.7 km/pixel at the
equator—not a rover-scale route or safety map.

## Tech
React, Vite, Three.js (React Three Fiber), Zustand
