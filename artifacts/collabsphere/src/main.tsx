import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// 🛠️ Yahan humne aapka live Render backend URL directly set kar diya hai
const apiBaseUrl = import.meta.env.VITE_API_URL || "https://aeronode-9t5a.onrender.com";

setBaseUrl(apiBaseUrl);

createRoot(document.getElementById('root')!).render(<App />);