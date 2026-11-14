# MarsWalk

An astronaut's journey from Earth to Mars with an interactive 3D Martian map.
NASA Space Apps Challenge 2026 - Interplanetary Survival Guide: Martian Map.

## Team
- Add your names here

## Run locally
npm install
npm run dev

## Tech
React, Vite, Three.js (React Three Fiber), Zustand

## P4 navigation API

The terrain-aware navigation backend and its P2/P6 adapter contracts are
documented in [`docs/P4_NAVIGATION.md`](docs/P4_NAVIGATION.md). It is a
separate FastAPI service; the current browser atlas does not call it yet.
