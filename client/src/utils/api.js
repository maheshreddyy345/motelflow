// In production (Cloud Run), frontend and API are on the same origin, so use relative path
// In development, the API runs on a different port (localhost:5000)
const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';

// Get auth token from localStorage
const getToken = () => localStorage.getItem('token');

// Generic fetch wrapper with auth
const fetchWithAuth = async (endpoint, options = {}) => {
    const token = getToken();

    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
    }

    return data;
};

// Auth API
export const authApi = {
    login: async (username, password) => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
    },

    getCurrentUser: () => fetchWithAuth('/auth/me'),

    register: (userData) => fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
    }),
};

// Dashboard API
export const dashboardApi = {
    getSummary: () => fetchWithAuth('/dashboard'),
};

// Rooms API
export const roomsApi = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchWithAuth(`/rooms${query ? `?${query}` : ''}`);
    },

    getByFloor: (floor) => fetchWithAuth(`/rooms/floor/${floor}`),

    getSummary: () => fetchWithAuth('/rooms/summary'),

    getAvailable: (checkIn, checkOut, roomType = '') => {
        const query = roomType ? `?roomType=${roomType}` : '';
        return fetchWithAuth(`/rooms/available/${checkIn}/${checkOut}${query}`);
    },

    updateStatus: (id, status, outOfOrderReason = '') => fetchWithAuth(`/rooms/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, outOfOrderReason }),
    }),
};

// Reservations API
export const reservationsApi = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchWithAuth(`/reservations${query ? `?${query}` : ''}`);
    },

    getById: (id) => fetchWithAuth(`/reservations/${id}`),

    getArrivals: (date) => fetchWithAuth(`/reservations/arrivals/${date}`),

    getDepartures: (date) => fetchWithAuth(`/reservations/departures/${date}`),

    getTapeChart: (startDate, endDate) =>
        fetchWithAuth(`/reservations/tape-chart/${startDate}/${endDate}`),

    create: (data) => fetchWithAuth('/reservations', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    update: (id, data) => fetchWithAuth(`/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),

    addPayment: (id, data) => fetchWithAuth(`/reservations/${id}/payment`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    checkIn: (id) => fetchWithAuth(`/reservations/${id}/checkin`, {
        method: 'PATCH',
    }),

    checkOut: (id, data = {}) => fetchWithAuth(`/reservations/${id}/checkout`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),

    cancel: (id, reason) => fetchWithAuth(`/reservations/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
    }),

    getCancelled: () => fetchWithAuth('/reservations?status=cancelled'),
};

// Housekeeping API
export const housekeepingApi = {
    getRooms: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchWithAuth(`/housekeeping/rooms${query ? `?${query}` : ''}`);
    },

    getSummary: () => fetchWithAuth('/housekeeping/summary'),

    updateRoom: (id, status, outOfOrderReason = '') =>
        fetchWithAuth(`/housekeeping/rooms/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, outOfOrderReason }),
        }),

    bulkUpdate: (roomIds, status) => fetchWithAuth('/housekeeping/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ roomIds, status }),
    }),
};

// Rates API
export const ratesApi = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return fetchWithAuth(`/rates${query ? `?${query}` : ''}`);
    },

    calculate: (roomType, category, checkIn, checkOut) =>
        fetchWithAuth(`/rates/calculate?roomType=${roomType}&category=${category}&checkIn=${checkIn}&checkOut=${checkOut}`),

    update: (id, data) => fetchWithAuth(`/rates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
};

// Settings API
export const settingsApi = {
    getAll: () => fetchWithAuth('/settings'),

    get: (key) => fetchWithAuth(`/settings/${key}`),

    update: (key, value) => fetchWithAuth(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
    }),
};

// Folio API
export const folioApi = {
    get: (id) => fetchWithAuth(`/folio/${id}`),

    addCharge: (id, data) => fetchWithAuth(`/folio/${id}/charges`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    voidCharge: (id, chargeId) => fetchWithAuth(`/folio/${id}/charges/${chargeId}`, {
        method: 'DELETE',
    }),

    addPayment: (id, data) => fetchWithAuth(`/folio/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    changeRoom: (id, newRoomId) => fetchWithAuth(`/folio/${id}/room`, {
        method: 'PATCH',
        body: JSON.stringify({ newRoomId }),
    }),

    generateRoomCharges: (id) => fetchWithAuth(`/folio/${id}/generate-room-charges`, {
        method: 'POST',
    }),
};

// Reports API
export const reportsApi = {
    getSummary: (startDate, endDate) =>
        fetchWithAuth(`/reports/summary?startDate=${startDate}&endDate=${endDate}`),

    getRevenue: (startDate, endDate) =>
        fetchWithAuth(`/reports/revenue?startDate=${startDate}&endDate=${endDate}`),

    getOccupancy: (startDate, endDate) =>
        fetchWithAuth(`/reports/occupancy?startDate=${startDate}&endDate=${endDate}`),

    getRates: (startDate, endDate) =>
        fetchWithAuth(`/reports/rates?startDate=${startDate}&endDate=${endDate}`),

    getPayments: (startDate, endDate) =>
        fetchWithAuth(`/reports/payments?startDate=${startDate}&endDate=${endDate}`),
};

// Payments API (Stripe)
export const paymentsApi = {
    getConfig: () => fetchWithAuth('/payments/config'),

    createIntent: (amount, reservationId, guestName, confirmationNumber) =>
        fetchWithAuth('/payments/create-intent', {
            method: 'POST',
            body: JSON.stringify({ amount, reservationId, guestName, confirmationNumber }),
        }),
};

// Night Audit API
export const nightAuditApi = {
    getPreview: () => fetchWithAuth('/night-audit/preview'),
    runAudit: (notes = '') => fetchWithAuth('/night-audit/run', {
        method: 'POST',
        body: JSON.stringify({ notes }),
    }),
    getHistory: () => fetchWithAuth('/night-audit/history'),
};

// Utility functions
export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

export const getToday = () => {
    return new Date().toISOString().split('T')[0];
};

export const getRoomTypeLabel = (code) => {
    const types = {
        SK: 'Single King',
        DQ: 'Double Queen',
        DQS: 'DQ Suite',
        ACC: 'Accessible',
    };
    return types[code] || code;
};

export const getStatusLabel = (status) => {
    const labels = {
        vacant_clean: 'Vacant Clean',
        vacant_dirty: 'Vacant Dirty',
        occupied: 'Occupied',
        inspected: 'Inspected',
        out_of_order: 'Out of Order',
    };
    return labels[status] || status;
};
