import axios from 'axios';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE = isLocalhost ? `http://${window.location.hostname}:5000/api` : '/api';

const api = axios.create({
    baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('activeConfigId');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const login = async (username, password) => {
    const response = await axios.post(`${API_BASE}/login`, { username, password });
    if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('username', response.data.username);
    }
    return response.data;
};

export const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('activeConfigId');
};

export const isAuthenticated = () => {
    return !!localStorage.getItem('authToken');
};

export default api;
export { API_BASE };
