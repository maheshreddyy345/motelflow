import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reservationsApi, roomsApi, ratesApi, formatDate, formatCurrency, getToday, getRoomTypeLabel } from '../utils/api';
import './Reservations.css';

const Reservations = () => {
    const navigate = useNavigate();
    const [reservations, setReservations] = useState([]);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedRes, setSelectedRes] = useState(null);

    // Tabs, sorting, and search state
    const [activeTab, setActiveTab] = useState('today');
    const [sortBy, setSortBy] = useState('check_in_asc');
    const [showSearch, setShowSearch] = useState(false);
    const [searchFilters, setSearchFilters] = useState({
        confirmation: '',
        guestName: '',
        dateFrom: '',
        dateTo: '',
        status: '',
    });

    // Cancel modal state
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelId, setCancelId] = useState(null);
    const [cancelReason, setCancelReason] = useState('');

    const cancellationReasons = [
        { value: 'cc_declined', label: 'Credit Card Declined' },
        { value: 'no_show', label: 'No Show' },
        { value: 'guest_request', label: 'Guest Requested' },
        { value: 'duplicate', label: 'Duplicate Booking' },
        { value: 'abandoned', label: 'Abandoned Inquiry' },
        { value: 'price_issue', label: 'Price/Rate Issue' },
        { value: 'changed_plans', label: 'Changed Travel Plans' },
        { value: 'other', label: 'Other' },
    ];

    // New reservation form state
    const [formData, setFormData] = useState({
        checkInDate: getToday(),
        checkOutDate: '',
        roomId: '',
        roomType: '',
        rateCategory: 'regular',
        nightlyRate: 0,
        numGuests: 1,
        earlyCheckinFee: 0,
        paymentMethod: 'cash',
        notes: '',
        guest: {
            firstName: '',
            lastName: '',
            phone: '',
            email: '',
            idNumber: '',
            idType: 'license',
            vehicleMake: '',
            vehicleModel: '',
            vehicleColor: '',
            vehiclePlate: '',
            vehicleState: '',
        }
    });

    useEffect(() => {
        loadReservations();
    }, []);

    const loadReservations = async () => {
        try {
            const data = await reservationsApi.getAll({ limit: 200 });
            setReservations(data);
        } catch (error) {
            console.error('Failed to load reservations:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableRooms = async () => {
        if (!formData.checkInDate || !formData.checkOutDate) return;
        try {
            const rooms = await roomsApi.getAvailable(
                formData.checkInDate,
                formData.checkOutDate,
                formData.roomType
            );
            setAvailableRooms(rooms);
        } catch (error) {
            console.error('Failed to load available rooms:', error);
        }
    };

    const calculateRate = async () => {
        if (!formData.roomType || !formData.checkInDate || !formData.checkOutDate) return;
        try {
            const rate = await ratesApi.calculate(
                formData.roomType,
                formData.rateCategory,
                formData.checkInDate,
                formData.checkOutDate
            );
            setFormData(prev => ({
                ...prev,
                nightlyRate: parseFloat(rate.weekdayRate)
            }));
        } catch (error) {
            console.error('Failed to calculate rate:', error);
        }
    };

    useEffect(() => {
        if (formData.checkInDate && formData.checkOutDate) {
            loadAvailableRooms();
        }
    }, [formData.checkInDate, formData.checkOutDate, formData.roomType]);

    useEffect(() => {
        calculateRate();
    }, [formData.roomType, formData.rateCategory, formData.checkInDate, formData.checkOutDate]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('guest.')) {
            const guestField = name.replace('guest.', '');
            setFormData(prev => ({
                ...prev,
                guest: { ...prev.guest, [guestField]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await reservationsApi.create(formData);
            setShowNewModal(false);
            loadReservations();
            // Reset form
            setFormData({
                checkInDate: getToday(),
                checkOutDate: '',
                roomId: '',
                roomType: '',
                rateCategory: 'regular',
                nightlyRate: 0,
                numGuests: 1,
                earlyCheckinFee: 0,
                paymentMethod: 'cash',
                notes: '',
                guest: {
                    firstName: '',
                    lastName: '',
                    phone: '',
                    email: '',
                    idNumber: '',
                    idType: 'license',
                    vehicleMake: '',
                    vehicleModel: '',
                    vehicleColor: '',
                    vehiclePlate: '',
                    vehicleState: '',
                }
            });
        } catch (error) {
            console.error('Failed to create reservation:', error);
            alert('Failed to create reservation: ' + error.message);
        }
    };

    const handleCheckIn = async (id) => {
        try {
            await reservationsApi.checkIn(id);
            loadReservations();
        } catch (error) {
            console.error('Failed to check in:', error);
            alert('Failed to check in: ' + error.message);
        }
    };

    const handleCheckOut = async (id) => {
        try {
            await reservationsApi.checkOut(id, { paymentStatus: 'paid' });
            loadReservations();
        } catch (error) {
            console.error('Failed to check out:', error);
            alert('Failed to check out: ' + error.message);
        }
    };

    const openCancelModal = (id) => {
        setCancelId(id);
        setCancelReason('');
        setShowCancelModal(true);
    };

    const handleConfirmCancel = async () => {
        if (!cancelReason) {
            alert('Please select a cancellation reason');
            return;
        }
        try {
            await reservationsApi.cancel(cancelId, cancelReason);
            setShowCancelModal(false);
            setCancelId(null);
            setCancelReason('');
            loadReservations();
        } catch (error) {
            console.error('Failed to cancel:', error);
            alert('Failed to cancel: ' + error.message);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            confirmed: 'badge-warning',
            checked_in: 'badge-success',
            checked_out: 'badge-info',
            cancelled: 'badge-danger',
        };
        return badges[status] || '';
    };

    // Helper: Calculate nights
    const calculateNights = (checkIn, checkOut) => {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    };

    // Helper: Check if date is today
    const isToday = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    // Helper: Check if date is tomorrow
    const isTomorrow = (dateStr) => {
        const date = new Date(dateStr);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return date.toDateString() === tomorrow.toDateString();
    };

    // Helper: Check if date is in next 7 days
    const isWithinWeek = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return date >= today && date <= weekFromNow;
    };

    // Helper: Can check in (not future date)
    const canCheckIn = (checkInDate) => {
        const date = new Date(checkInDate);
        const today = new Date();
        date.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return date <= today;
    };

    // Filter reservations based on tab and search
    const getFilteredReservations = () => {
        let filtered = [...reservations];

        // Apply tab filter
        if (activeTab === 'today') {
            filtered = filtered.filter(r => isToday(r.check_in_date) && ['confirmed', 'checked_in'].includes(r.status));
        } else if (activeTab === 'tomorrow') {
            filtered = filtered.filter(r => isTomorrow(r.check_in_date) && r.status === 'confirmed');
        } else if (activeTab === 'upcoming') {
            filtered = filtered.filter(r => isWithinWeek(r.check_in_date) && r.status === 'confirmed');
        }
        // 'all' shows everything

        // Apply search filters
        if (searchFilters.confirmation) {
            filtered = filtered.filter(r =>
                r.confirmation_number?.toLowerCase().includes(searchFilters.confirmation.toLowerCase())
            );
        }
        if (searchFilters.guestName) {
            filtered = filtered.filter(r =>
                `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchFilters.guestName.toLowerCase())
            );
        }
        if (searchFilters.dateFrom) {
            filtered = filtered.filter(r => new Date(r.check_in_date) >= new Date(searchFilters.dateFrom));
        }
        if (searchFilters.dateTo) {
            filtered = filtered.filter(r => new Date(r.check_in_date) <= new Date(searchFilters.dateTo));
        }
        if (searchFilters.status) {
            filtered = filtered.filter(r => r.status === searchFilters.status);
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'name_asc':
                    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
                case 'name_desc':
                    return `${b.last_name} ${b.first_name}`.localeCompare(`${a.last_name} ${a.first_name}`);
                case 'check_in_asc':
                    return new Date(a.check_in_date) - new Date(b.check_in_date);
                case 'check_in_desc':
                    return new Date(b.check_in_date) - new Date(a.check_in_date);
                case 'nights_asc':
                    return calculateNights(a.check_in_date, a.check_out_date) - calculateNights(b.check_in_date, b.check_out_date);
                case 'nights_desc':
                    return calculateNights(b.check_in_date, b.check_out_date) - calculateNights(a.check_in_date, a.check_out_date);
                default:
                    return 0;
            }
        });

        return filtered;
    };

    const filteredReservations = getFilteredReservations();

    const clearSearch = () => {
        setSearchFilters({
            confirmation: '',
            guestName: '',
            dateFrom: '',
            dateTo: '',
            status: '',
        });
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="reservations-page">
            <div className="page-header">
                <div>
                    <h1>Reservations</h1>
                    <p className="text-muted">Manage guest reservations</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
                    + New Reservation
                </button>
            </div>

            {/* Tabs */}
            <div className="tabs-container">
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'today' ? 'active' : ''}`}
                        onClick={() => setActiveTab('today')}
                    >
                        Today's Arrivals
                    </button>
                    <button
                        className={`tab ${activeTab === 'tomorrow' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tomorrow')}
                    >
                        Tomorrow
                    </button>
                    <button
                        className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
                        onClick={() => setActiveTab('upcoming')}
                    >
                        Upcoming (7 days)
                    </button>
                    <button
                        className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All Reservations
                    </button>
                </div>
                <div className="tabs-actions">
                    <button
                        className={`btn btn-sm ${showSearch ? 'btn-secondary' : 'btn-outline'}`}
                        onClick={() => setShowSearch(!showSearch)}
                    >
                        🔍 Search
                    </button>
                </div>
            </div>

            {/* Search Panel */}
            {showSearch && (
                <div className="search-panel card">
                    <div className="search-grid">
                        <div className="form-group">
                            <label className="form-label">Confirmation #</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="MF..."
                                value={searchFilters.confirmation}
                                onChange={e => setSearchFilters({ ...searchFilters, confirmation: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Guest Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Search name..."
                                value={searchFilters.guestName}
                                onChange={e => setSearchFilters({ ...searchFilters, guestName: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Check-in From</label>
                            <input
                                type="date"
                                className="form-input"
                                value={searchFilters.dateFrom}
                                onChange={e => setSearchFilters({ ...searchFilters, dateFrom: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Check-in To</label>
                            <input
                                type="date"
                                className="form-input"
                                value={searchFilters.dateTo}
                                onChange={e => setSearchFilters({ ...searchFilters, dateTo: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input form-select"
                                value={searchFilters.status}
                                onChange={e => setSearchFilters({ ...searchFilters, status: e.target.value })}
                            >
                                <option value="">All Statuses</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="checked_in">Checked In</option>
                                <option value="checked_out">Checked Out</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div className="form-group search-actions">
                            <button className="btn btn-sm btn-secondary" onClick={clearSearch}>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sort and Results Info */}
            <div className="list-controls">
                <span className="results-count">{filteredReservations.length} reservations</span>
                <div className="sort-control">
                    <label>Sort by:</label>
                    <select
                        className="form-input form-select"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                    >
                        <option value="check_in_asc">Check-In (Soonest)</option>
                        <option value="check_in_desc">Check-In (Latest)</option>
                        <option value="name_asc">Guest Name (A-Z)</option>
                        <option value="name_desc">Guest Name (Z-A)</option>
                        <option value="nights_asc">Nights (Short→Long)</option>
                        <option value="nights_desc">Nights (Long→Short)</option>
                    </select>
                </div>
            </div>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Confirmation</th>
                            <th>Guest</th>
                            <th>Room</th>
                            <th>Check In</th>
                            <th>Check Out</th>
                            <th>Nights</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReservations.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="empty-table">
                                    No reservations found for this filter
                                </td>
                            </tr>
                        ) : (
                            filteredReservations.map((res) => (
                                <tr key={res.id} className="clickable-row" onClick={() => navigate(`/folio/${res.id}`)}>
                                    <td><strong>{res.confirmation_number}</strong></td>
                                    <td>{res.first_name} {res.last_name}</td>
                                    <td>{res.room_number || 'Unassigned'}</td>
                                    <td>{formatDate(res.check_in_date)}</td>
                                    <td>{formatDate(res.check_out_date)}</td>
                                    <td><span className="nights-badge">{calculateNights(res.check_in_date, res.check_out_date)}</span></td>
                                    <td>
                                        <span className={`badge ${getStatusBadge(res.status)}`}>
                                            {res.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => navigate(`/folio/${res.id}`)}
                                        >
                                            Folio
                                        </button>
                                        {res.status === 'confirmed' && (
                                            <>
                                                {canCheckIn(res.check_in_date) ? (
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => handleCheckIn(res.id)}
                                                        style={{ marginLeft: '0.5rem' }}
                                                    >
                                                        Check In
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn btn-sm btn-disabled"
                                                        disabled
                                                        title={`Check-in available on ${formatDate(res.check_in_date)}`}
                                                        style={{ marginLeft: '0.5rem' }}
                                                    >
                                                        Future
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => openCancelModal(res.id)}
                                                    style={{ marginLeft: '0.5rem' }}
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        )}
                                        {res.status === 'checked_in' && (
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleCheckOut(res.id)}
                                                style={{ marginLeft: '0.5rem' }}
                                            >
                                                Check Out
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showNewModal && (
                <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">New Walk-In Reservation</h3>
                            <button className="modal-close" onClick={() => setShowNewModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-section">
                                    <h4>Stay Details</h4>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Check In Date</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                name="checkInDate"
                                                value={formData.checkInDate}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Check Out Date</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                name="checkOutDate"
                                                value={formData.checkOutDate}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Room Type</label>
                                            <select
                                                className="form-input form-select"
                                                name="roomType"
                                                value={formData.roomType}
                                                onChange={handleInputChange}
                                                required
                                            >
                                                <option value="">Select type</option>
                                                <option value="SK">Single King</option>
                                                <option value="DQ">Double Queen</option>
                                                <option value="DQS">Double Queen Suite</option>
                                                <option value="ACC">Accessible</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Rate Category</label>
                                            <select
                                                className="form-input form-select"
                                                name="rateCategory"
                                                value={formData.rateCategory}
                                                onChange={handleInputChange}
                                            >
                                                <option value="regular">Regular</option>
                                                <option value="aaa">AAA</option>
                                                <option value="military">Military</option>
                                                <option value="government">Government</option>
                                                <option value="senior">Senior (65+)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Room</label>
                                            <select
                                                className="form-input form-select"
                                                name="roomId"
                                                value={formData.roomId}
                                                onChange={handleInputChange}
                                                required
                                            >
                                                <option value="">Select room</option>
                                                {availableRooms.map(room => (
                                                    <option key={room.id} value={room.id}>
                                                        {room.room_number} - {getRoomTypeLabel(room.room_type)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Nightly Rate</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                name="nightlyRate"
                                                value={formData.nightlyRate}
                                                onChange={handleInputChange}
                                                step="0.01"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h4>Guest Information</h4>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">First Name</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                name="guest.firstName"
                                                value={formData.guest.firstName}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Last Name</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                name="guest.lastName"
                                                value={formData.guest.lastName}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Phone</label>
                                            <input
                                                type="tel"
                                                className="form-input"
                                                name="guest.phone"
                                                value={formData.guest.phone}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Email</label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                name="guest.email"
                                                value={formData.guest.email}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">ID Number</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                name="guest.idNumber"
                                                value={formData.guest.idNumber}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Guests</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                name="numGuests"
                                                value={formData.numGuests}
                                                onChange={handleInputChange}
                                                min="1"
                                                max="6"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h4>Vehicle Information</h4>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Make</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                name="guest.vehicleMake"
                                                value={formData.guest.vehicleMake}
                                                onChange={handleInputChange}
                                                placeholder="e.g., Toyota"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Model</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                name="guest.vehicleModel"
                                                value={formData.guest.vehicleModel}
                                                onChange={handleInputChange}
                                                placeholder="e.g., Camry"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Color</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                name="guest.vehicleColor"
                                                value={formData.guest.vehicleColor}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Plate</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                name="guest.vehiclePlate"
                                                value={formData.guest.vehiclePlate}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowNewModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create Reservation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Cancel Reservation</h3>
                            <button className="modal-close" onClick={() => setShowCancelModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to cancel this reservation?</p>
                            <div className="form-group">
                                <label className="form-label">Reason for Cancellation *</label>
                                <select
                                    className="form-input form-select"
                                    value={cancelReason}
                                    onChange={e => setCancelReason(e.target.value)}
                                    required
                                >
                                    <option value="">Select a reason...</option>
                                    {cancellationReasons.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                                Go Back
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleConfirmCancel}
                                disabled={!cancelReason}
                            >
                                Cancel Reservation
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reservations;
