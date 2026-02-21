import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reservationsApi, roomsApi, ratesApi, formatDate, getToday, getRoomTypeLabel, formatCurrency } from '../utils/api';
import './TapeChart.css';

const TapeChart = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(getToday());
    const [days, setDays] = useState(7);

    // New reservation modal state
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [formData, setFormData] = useState({
        checkInDate: '',
        checkOutDate: '',
        roomId: '',
        nightlyRate: 79,
        numGuests: 1,
        guest: { firstName: '', lastName: '', phone: '' }
    });

    useEffect(() => {
        loadData();
    }, [startDate, days]);

    const loadData = async () => {
        setLoading(true);
        try {
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + days);

            const [roomsData, reservationsData] = await Promise.all([
                roomsApi.getAll(),
                reservationsApi.getTapeChart(startDate, endDate.toISOString().split('T')[0]),
            ]);

            setRooms(roomsData);
            setReservations(reservationsData);
        } catch (error) {
            console.error('Failed to load tape chart:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateDates = () => {
        const dates = [];
        const current = new Date(startDate);
        for (let i = 0; i < days; i++) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };

    const getReservationForRoomAndDate = (roomId, date) => {
        const dateStr = date.toISOString().split('T')[0];
        return reservations.find(res => {
            const checkIn = new Date(res.check_in_date);
            const checkOut = new Date(res.check_out_date);
            const currentDate = new Date(dateStr);
            return res.room_id === roomId && currentDate >= checkIn && currentDate < checkOut;
        });
    };

    const isFirstDay = (res, date) => {
        const dateStr = date.toISOString().split('T')[0];
        return res.check_in_date.split('T')[0] === dateStr;
    };

    const getReservationSpan = (res, date) => {
        const dateStr = date.toISOString().split('T')[0];
        const checkIn = new Date(res.check_in_date);
        const checkOut = new Date(res.check_out_date);
        const currentDate = new Date(dateStr);

        const remainingDays = Math.ceil((checkOut - currentDate) / (1000 * 60 * 60 * 24));
        const endOfView = new Date(startDate);
        endOfView.setDate(endOfView.getDate() + days);
        const daysInView = Math.ceil((endOfView - currentDate) / (1000 * 60 * 60 * 24));

        return Math.min(remainingDays, daysInView);
    };

    const formatDayHeader = (date) => {
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateNum = date.getDate();
        return { day, dateNum };
    };

    const navigateDates = (direction) => {
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + (direction * days));
        setStartDate(newDate.toISOString().split('T')[0]);
    };

    const goToToday = () => {
        setStartDate(getToday());
    };

    // Click on booking → navigate to folio page
    const handleBookingClick = (reservationId) => {
        navigate(`/folio/${reservationId}`);
    };

    // Click on empty cell → open new reservation modal
    const handleEmptyCellClick = (room, date) => {
        const dateStr = date.toISOString().split('T')[0];
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        setSelectedRoom(room);
        setSelectedDate(dateStr);
        setFormData({
            checkInDate: dateStr,
            checkOutDate: nextDay.toISOString().split('T')[0],
            roomId: room.id,
            nightlyRate: 79,
            numGuests: 1,
            guest: { firstName: '', lastName: '', phone: '' }
        });
        setShowNewModal(true);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('guest.')) {
            const field = name.replace('guest.', '');
            setFormData(prev => ({
                ...prev,
                guest: { ...prev.guest, [field]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const result = await reservationsApi.create(formData);
            setShowNewModal(false);
            loadData();
            // Navigate to the new folio - API returns { reservation: {...}, confirmationNumber }
            navigate(`/folio/${result.reservation.id}`);
        } catch (error) {
            console.error('Failed to create reservation:', error);
            alert('Failed to create reservation: ' + error.message);
        }
    };

    const dates = generateDates();
    const floors = [1, 2, 3];

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="tape-chart-page">
            <div className="page-header">
                <div>
                    <h1>Tape Chart</h1>
                    <p className="text-muted">Click a booking to view · Click empty cell to reserve</p>
                </div>
                <div className="chart-controls">
                    <button className="btn btn-secondary" onClick={() => navigateDates(-1)}>
                        ← Previous
                    </button>
                    <button className="btn btn-primary" onClick={goToToday}>
                        Today
                    </button>
                    <button className="btn btn-secondary" onClick={() => navigateDates(1)}>
                        Next →
                    </button>
                    <select
                        className="form-input form-select"
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        style={{ width: 'auto' }}
                    >
                        <option value={7}>7 Days</option>
                        <option value={14}>14 Days</option>
                        <option value={30}>30 Days</option>
                    </select>
                </div>
            </div>

            <div className="tape-chart-container">
                <div className="tape-chart">
                    {/* Header row */}
                    <div className="tape-header">
                        <div className="tape-header-cell room-header">Room</div>
                        {dates.map((date, idx) => {
                            const { day, dateNum } = formatDayHeader(date);
                            const isToday = date.toISOString().split('T')[0] === getToday();
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            return (
                                <div
                                    key={idx}
                                    className={`tape-header-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
                                >
                                    <div className="day-name">{day}</div>
                                    <div className="day-num">{dateNum}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Room rows by floor */}
                    {floors.map(floor => (
                        <div key={floor} className="floor-group">
                            <div className="floor-label">Floor {floor}</div>
                            {rooms
                                .filter(room => room.floor === floor)
                                .slice(0, 15)
                                .map(room => (
                                    <div key={room.id} className="tape-row">
                                        <div className="tape-room-cell">
                                            <span className="room-num">{room.room_number}</span>
                                            <span className="room-type-mini">{room.room_type}</span>
                                        </div>
                                        {dates.map((date, idx) => {
                                            const reservation = getReservationForRoomAndDate(room.id, date);
                                            const isToday = date.toISOString().split('T')[0] === getToday();
                                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                                            if (reservation && isFirstDay(reservation, date)) {
                                                const span = getReservationSpan(reservation, date);
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`tape-day-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
                                                        style={{ position: 'relative' }}
                                                    >
                                                        <div
                                                            className={`tape-booking ${reservation.status} clickable`}
                                                            style={{ width: `calc(${span * 100}% + ${(span - 1) * 1}px)` }}
                                                            title={`${reservation.first_name} ${reservation.last_name}\n${formatDate(reservation.check_in_date)} - ${formatDate(reservation.check_out_date)}\nClick to open folio`}
                                                            onClick={() => handleBookingClick(reservation.id)}
                                                        >
                                                            {reservation.last_name}
                                                        </div>
                                                    </div>
                                                );
                                            } else if (reservation) {
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`tape-day-cell covered ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
                                                    />
                                                );
                                            } else {
                                                // Empty cell - clickable to create reservation
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`tape-day-cell empty clickable-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
                                                        title={`Create reservation\nRoom ${room.room_number} on ${formatDate(date)}`}
                                                        onClick={() => handleEmptyCellClick(room, date)}
                                                    />
                                                );
                                            }
                                        })}
                                    </div>
                                ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className="chart-legend">
                <div className="legend-item">
                    <div className="legend-color confirmed"></div>
                    <span>Reserved</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color checked_in"></div>
                    <span>Checked In</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color empty-cell"></div>
                    <span>Available (click to book)</span>
                </div>
            </div>

            {/* Quick Reservation Modal */}
            {showNewModal && selectedRoom && (
                <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Quick Reservation - Room {selectedRoom.room_number}</h3>
                            <button className="modal-close" onClick={() => setShowNewModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="room-preview">
                                    <span className="room-badge">{selectedRoom.room_number}</span>
                                    <span>{getRoomTypeLabel(selectedRoom.room_type)} · Floor {selectedRoom.floor}</span>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Check In</label>
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
                                        <label>Check Out</label>
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
                                        <label>First Name</label>
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
                                        <label>Last Name</label>
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
                                        <label>Phone</label>
                                        <input
                                            type="tel"
                                            className="form-input"
                                            name="guest.phone"
                                            value={formData.guest.phone}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Nightly Rate</label>
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
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowNewModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-success">
                                    Create & Open Folio
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TapeChart;
