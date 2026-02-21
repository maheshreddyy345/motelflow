import { useState, useEffect } from 'react';
import { roomsApi, getRoomTypeLabel, getStatusLabel } from '../utils/api';
import './Rooms.css';

const Rooms = () => {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFloor, setActiveFloor] = useState('all');
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        loadRooms();
    }, []);

    const loadRooms = async () => {
        try {
            const data = await roomsApi.getAll();
            setRooms(data);
        } catch (error) {
            console.error('Failed to load rooms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (roomId, newStatus) => {
        try {
            await roomsApi.updateStatus(roomId, newStatus);
            await loadRooms();
            setShowModal(false);
            setSelectedRoom(null);
        } catch (error) {
            console.error('Failed to update room status:', error);
        }
    };

    const getFilteredRooms = () => {
        if (activeFloor === 'all') return rooms;
        return rooms.filter(room => room.floor === parseInt(activeFloor));
    };

    const getStatusClass = (status) => {
        return status.replace('_', '-');
    };

    const floors = [1, 2, 3];
    const filteredRooms = getFilteredRooms();

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="rooms-page">
            <div className="page-header">
                <div>
                    <h1>Room Management</h1>
                    <p className="text-muted">View and manage all rooms</p>
                </div>
            </div>

            <div className="floor-tabs">
                <button
                    className={`floor-tab ${activeFloor === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveFloor('all')}
                >
                    All Floors
                </button>
                {floors.map(floor => (
                    <button
                        key={floor}
                        className={`floor-tab ${activeFloor === String(floor) ? 'active' : ''}`}
                        onClick={() => setActiveFloor(String(floor))}
                    >
                        Floor {floor}
                    </button>
                ))}
            </div>

            <div className="status-legend">
                <div className="legend-item">
                    <div className="legend-color vacant-clean"></div>
                    <span>Vacant Clean</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color vacant-dirty"></div>
                    <span>Vacant Dirty</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color occupied"></div>
                    <span>Occupied</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color inspected"></div>
                    <span>Inspected</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color out-of-order"></div>
                    <span>Out of Order</span>
                </div>
            </div>

            {activeFloor === 'all' ? (
                floors.map(floor => (
                    <div key={floor} className="floor-section">
                        <h3 className="floor-title">Floor {floor}</h3>
                        <div className="room-grid">
                            {rooms
                                .filter(room => room.floor === floor)
                                .map(room => (
                                    <div
                                        key={room.id}
                                        className={`room-card ${getStatusClass(room.status)}`}
                                        onClick={() => {
                                            setSelectedRoom(room);
                                            setShowModal(true);
                                        }}
                                    >
                                        <div className="room-number">{room.room_number}</div>
                                        <div className="room-type">{room.room_type}</div>
                                    </div>
                                ))}
                        </div>
                    </div>
                ))
            ) : (
                <div className="room-grid">
                    {filteredRooms.map(room => (
                        <div
                            key={room.id}
                            className={`room-card ${getStatusClass(room.status)}`}
                            onClick={() => {
                                setSelectedRoom(room);
                                setShowModal(true);
                            }}
                        >
                            <div className="room-number">{room.room_number}</div>
                            <div className="room-type">{room.room_type}</div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && selectedRoom && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Room {selectedRoom.room_number}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="room-details">
                                <div className="detail-row">
                                    <span className="detail-label">Room Type</span>
                                    <span className="detail-value">{getRoomTypeLabel(selectedRoom.room_type)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Floor</span>
                                    <span className="detail-value">{selectedRoom.floor}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Current Status</span>
                                    <span className={`badge status-${getStatusClass(selectedRoom.status)}`}>
                                        {getStatusLabel(selectedRoom.status)}
                                    </span>
                                </div>
                            </div>

                            <div className="status-actions">
                                <p className="text-sm text-muted mb-sm">Change Status:</p>
                                <div className="status-buttons">
                                    <button
                                        className="btn btn-sm status-btn vacant-clean"
                                        onClick={() => handleStatusChange(selectedRoom.id, 'vacant_clean')}
                                        disabled={selectedRoom.status === 'vacant_clean'}
                                    >
                                        Vacant Clean
                                    </button>
                                    <button
                                        className="btn btn-sm status-btn vacant-dirty"
                                        onClick={() => handleStatusChange(selectedRoom.id, 'vacant_dirty')}
                                        disabled={selectedRoom.status === 'vacant_dirty'}
                                    >
                                        Vacant Dirty
                                    </button>
                                    <button
                                        className="btn btn-sm status-btn inspected"
                                        onClick={() => handleStatusChange(selectedRoom.id, 'inspected')}
                                        disabled={selectedRoom.status === 'inspected'}
                                    >
                                        Inspected
                                    </button>
                                    <button
                                        className="btn btn-sm status-btn out-of-order"
                                        onClick={() => handleStatusChange(selectedRoom.id, 'out_of_order')}
                                        disabled={selectedRoom.status === 'out_of_order'}
                                    >
                                        Out of Order
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Rooms;
