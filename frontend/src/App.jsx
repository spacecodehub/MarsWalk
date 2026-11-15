import { useState } from 'react'
import MarsScene from './components/MarsScene'
import Dashboard from './AppShell'

export default function App() {
  const [entered, setEntered] = useState(false)

  return (
    <>
      {!entered && (
        <MarsScene background interactive onPlanetClick={() => setEntered(true)}>
          <h1 className="mw-title">MarsWalk</h1>
          <p className="mw-sub">SECTOR: JEZERO CRATER · CLICK MARS TO ENTER</p>
        </MarsScene>
      )}

      {entered && (
        <div className="app-fade-in">
          <Dashboard />
          <button className="mw-return" onClick={() => setEntered(false)}>
            ← Return to Mars
          </button>
        </div>
      )}
    </>
  )
}