import React from 'react'
import Mobile from './pages/Mobile.jsx'
import Help from './pages/Help.jsx'

export default function App() {
  const path = window.location.pathname;
  if (path === '/help') {
    return <Help />;
  }
  return <Mobile />
}
