import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import CloudflareDotMatriks from './page/cloudflare_dot_matriks'

const router = createBrowserRouter([
  
  {
    path: '/',
    Component: CloudflareDotMatriks,
  },
  

  
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)