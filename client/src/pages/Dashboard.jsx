import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, reservationsApi, roomsApi, getToday, formatDate } from '../utils/api';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [allReservations, setAllReservations] = useState([]);
    const [arrivals, setArrivals] = useState([]);
    const [departures, setDepartures] = useState([]);
    const [occupiedGuests, setOccupiedGuests] = useState([]);
    const [cancelled, setCancelled] = useState([]);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [loading, setLoading] = useState(true);

    // Expanded state for each card
    const [expandedCard, setExpandedCard] = useState(null);

    const cancellationReasonLabels = {
        cc_declined: 'CC Declined',
        no_show: 'No Show',
        guest_request: 'Guest Requested',
        duplicate: 'Duplicate',
        abandoned: 'Abandoned',
        price_issue: 'Price Issue',
        changed_plans: 'Changed Plans',
        other: 'Other',
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const today = getToday();
            const [summary, reservationsData, allRooms] = await Promise.all([
                dashboardApi.getSummary(),
                reservationsApi.getAll({ limit: 500 }),
                roomsApi.getAll(),
            ]);
            setData(summary);
            setAllReservations(reservationsData);

            // Filter reservations by status and date
            const todayDate = new Date(today);

            // Arrivals: check_in_date = today AND (confirmed OR checked_in)
            const arrivalsFiltered = reservationsData.filter(r => {
                const checkIn = new Date(r.check_in_date);
                return checkIn.toDateString() === todayDate.toDateString() &&
                    (r.status === 'confirmed' || r.status === 'checked_in');
            });

            // Departures: check_out_date = today AND checked_in
            const departuresFiltered = reservationsData.filter(r => {
                const checkOut = new Date(r.check_out_date);
                return checkOut.toDateString() === todayDate.toDateString() &&
                    r.status === 'checked_in';
            });

            // Occupied: all guests currently checked_in (regardless of date)
            const occupiedFiltered = reservationsData.filter(r => r.status === 'checked_in');

            // Cancelled: recent cancellations (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const cancelledFiltered = reservationsData.filter(r => {
                const updated = new Date(r.updated_at);
                return r.status === 'cancelled' && updated >= sevenDaysAgo;
            });

            setArrivals(arrivalsFiltered);
            setDepartures(departuresFiltered);
            setOccupiedGuests(occupiedFiltered);
            setCancelled(cancelledFiltered);

            // Available rooms
            setAvailableRooms(allRooms.filter(r => r.status === 'vacant_clean'));
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickCheckIn = async (id, e) => {
        e.stopPropagation();
        try {
            await reservationsApi.checkIn(id);
            loadData();
        } catch (error) {
            alert('Check-in failed: ' + error.message);
        }
    };

    const handleQuickCheckOut = async (id, e) => {
        e.stopPropagation();
        try {
            await reservationsApi.checkOut(id);
            loadData();
        } catch (error) {
            alert('Check-out failed: ' + error.message);
        }
    };

    const toggleCard = (cardName) => {
        setExpandedCard(expandedCard === cardName ? null : cardName);
    };

    const openFolio = (id) => {
        navigate(`/folio/${id}`);
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    const stats = [
        {
            key: 'available',
            label: 'Available Rooms',
            value: data?.rooms?.available || 0,
            icon: '🟢',
            color: 'success',
            hint: 'Click to see rooms',
        },
        {
            key: 'occupied',
            label: 'Occupied',
            value: occupiedGuests.length,
            icon: '🔵',
            color: 'primary',
            hint: 'Click to see guests',
        },
        {
            key: 'arrivals',
            label: 'Arrivals Today',
            value: arrivals.length,
            icon: '📥',
            color: 'info',
            hint: 'Click to check in',
        },
        {
            key: 'departures',
            label: 'Departures Today',
            value: departures.length,
            icon: '📤',
            color: 'warning',
            hint: 'Click to check out',
            badge: departures.length > 0 ? departures.length : null,
        },
        {
            key: 'cancelled',
            label: 'Cancelled (7d)',
            value: cancelled.length,
            icon: '❌',
            color: 'danger',
            hint: 'Click to view',
        },
    ];

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div>
                    <h1>Dashboard</h1>
                    <p className="text-muted">Welcome back! Click any card to see details.</p>
                </div>
                <div className="occupancy-badge">
                    <span className="occupancy-value">{data?.occupancyRate || 0}%</span>
                    <span className="occupancy-label">Occupancy</span>
                </div>
            </div>

            <div className="stats-grid">
                {stats.map((stat) => (
                    <div
                        key={stat.key}
                        className={`stat-card clickable ${expandedCard === stat.key ? 'expanded' : ''}`}
                        onClick={() => toggleCard(stat.key)}
                    >
                        <div className={`stat-icon ${stat.color}`}>
                            {stat.icon}
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {stat.value}
                                {stat.badge && (
                                    <span className="stat-alert-badge">{stat.badge}</span>
                                )}
                            </div>
                            <div className="stat-label">{stat.label}</div>
                        </div>
                        <div className="stat-expand-icon">
                            {expandedCard === stat.key ? '▲' : '▼'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Expanded Content */}
            {expandedCard && (
                <div className="expanded-content card">
                    {/* Available Rooms */}
                    {expandedCard === 'available' && (
                        <>
                            <div className="card-header">
                                <h3 className="card-title">🟢 Available Rooms</h3>
                                <span className="badge badge-success">{availableRooms.length}</span>
                            </div>
                            {availableRooms.length === 0 ? (
                                <p className="empty-state">No rooms available right now</p>
                            ) : (
                                <div className="room-grid">
                                    {availableRooms.map(room => (
                                        <div
                                            key={room.id}
                                            className="room-card available"
                                            onClick={() => navigate('/tape-chart')}
                                        >
                                            <span className="room-number">{room.room_number}</span>
                                            <span className="room-type">{room.room_type}</span>
                                            <span className="room-floor">Floor {room.floor}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Occupied Rooms */}
                    {expandedCard === 'occupied' && (
                        <>
                            <div className="card-header">
                                <h3 className="card-title">🔵 Currently Checked In</h3>
                                <span className="badge badge-primary">{occupiedGuests.length}</span>
                            </div>
                            {occupiedGuests.length === 0 ? (
                                <p className="empty-state">No guests currently checked in</p>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Room</th>
                                            <th>Guest</th>
                                            <th>Check Out</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {occupiedGuests.map(res => (
                                            <tr key={res.id} className="clickable-row" onClick={() => openFolio(res.id)}>
                                                <td><span className="room-badge">{res.room_number}</span></td>
                                                <td>
                                                    <div className="guest-name">{res.first_name} {res.last_name}</div>
                                                </td>
                                                <td>{formatDate(res.check_out_date)}</td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <button className="btn btn-sm btn-primary" onClick={() => openFolio(res.id)}>
                                                        Folio
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}

                    {/* Today's Arrivals */}
                    {expandedCard === 'arrivals' && (
                        <>
                            <div className="card-header">
                                <h3 className="card-title">📥 Today's Arrivals</h3>
                                <span className="badge badge-info">{arrivals.length}</span>
                            </div>
                            {arrivals.length === 0 ? (
                                <p className="empty-state">No arrivals today</p>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Guest</th>
                                            <th>Room</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {arrivals.map(res => (
                                            <tr key={res.id} className="clickable-row" onClick={() => openFolio(res.id)}>
                                                <td>
                                                    <div className="guest-name">{res.first_name} {res.last_name}</div>
                                                    <div className="guest-phone text-muted">{res.phone}</div>
                                                </td>
                                                <td><span className="room-badge">{res.room_number || 'TBA'}</span></td>
                                                <td>
                                                    {res.status === 'checked_in' ? (
                                                        <span className="badge badge-success">✓ Checked In</span>
                                                    ) : (
                                                        <span className="badge badge-warning">Pending</span>
                                                    )}
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    {res.status === 'confirmed' && (
                                                        <button
                                                            className="btn btn-sm btn-success"
                                                            onClick={(e) => handleQuickCheckIn(res.id, e)}
                                                        >
                                                            Check In
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-sm btn-secondary ml-sm"
                                                        onClick={() => openFolio(res.id)}
                                                    >
                                                        Folio
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}

                    {/* Today's Departures */}
                    {expandedCard === 'departures' && (
                        <>
                            <div className="card-header">
                                <h3 className="card-title">📤 Today's Departures</h3>
                                <span className="badge badge-warning">{departures.length}</span>
                            </div>
                            {departures.length === 0 ? (
                                <p className="empty-state">No departures today</p>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Guest</th>
                                            <th>Room</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {departures.map(res => (
                                            <tr key={res.id} className="clickable-row" onClick={() => openFolio(res.id)}>
                                                <td>
                                                    <div className="guest-name">{res.first_name} {res.last_name}</div>
                                                    <div className="guest-phone text-muted">{res.phone}</div>
                                                </td>
                                                <td><span className="room-badge">{res.room_number}</span></td>
                                                <td>
                                                    {res.status === 'checked_out' ? (
                                                        <span className="badge badge-info">✓ Checked Out</span>
                                                    ) : (
                                                        <span className="badge badge-warning">Awaiting</span>
                                                    )}
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    {res.status === 'checked_in' && (
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={(e) => handleQuickCheckOut(res.id, e)}
                                                        >
                                                            Check Out
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-sm btn-secondary ml-sm"
                                                        onClick={() => openFolio(res.id)}
                                                    >
                                                        Folio
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}

                    {/* Cancelled Reservations */}
                    {expandedCard === 'cancelled' && (
                        <>
                            <div className="card-header">
                                <h3 className="card-title">❌ Recent Cancellations</h3>
                                <span className="badge badge-danger">{cancelled.length}</span>
                            </div>
                            {cancelled.length === 0 ? (
                                <p className="empty-state">No cancellations in the last 7 days</p>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Guest</th>
                                            <th>Room</th>
                                            <th>Reason</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cancelled.map(res => (
                                            <tr key={res.id} className="clickable-row" onClick={() => openFolio(res.id)}>
                                                <td>
                                                    <div className="guest-name">{res.first_name} {res.last_name}</div>
                                                </td>
                                                <td><span className="room-badge">{res.room_number}</span></td>
                                                <td>
                                                    <span className="badge badge-danger">
                                                        {cancellationReasonLabels[res.cancellation_reason] || res.cancellation_reason || 'Unknown'}
                                                    </span>
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => openFolio(res.id)}
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Room Status Overview */}
            <div className="card mt-lg">
                <div className="card-header">
                    <h3 className="card-title">🚪 Room Status Overview</h3>
                </div>
                <div className="room-status-summary">
                    <div className="status-item clickable" onClick={() => toggleCard('available')}>
                        <div className="status-dot vacant-clean"></div>
                        <span className="status-label">Vacant Clean</span>
                        <span className="status-count">{data?.rooms?.available || 0}</span>
                    </div>
                    <div className="status-item">
                        <div className="status-dot vacant-dirty"></div>
                        <span className="status-label">Vacant Dirty</span>
                        <span className="status-count">{data?.rooms?.dirty || 0}</span>
                    </div>
                    <div className="status-item clickable" onClick={() => toggleCard('occupied')}>
                        <div className="status-dot occupied"></div>
                        <span className="status-label">Occupied</span>
                        <span className="status-count">{data?.rooms?.occupied || 0}</span>
                    </div>
                    <div className="status-item">
                        <div className="status-dot out-of-order"></div>
                        <span className="status-label">Out of Order</span>
                        <span className="status-count">{data?.rooms?.out_of_order || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
