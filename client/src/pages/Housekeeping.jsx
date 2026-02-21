import { useState, useEffect } from 'react';
import { housekeepingApi, getStatusLabel } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Housekeeping.css';

const Housekeeping = () => {
    const [rooms, setRooms] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeFloor, setActiveFloor] = useState('all');
    const [activeStatus, setActiveStatus] = useState('all');
    const [oooModal, setOooModal] = useState({ open: false, roomId: null, roomNumber: '' });
    const [oooReason, setOooReason] = useState('');

    // Bulk Selection State
    const [selectedRooms, setSelectedRooms] = useState(new Set());
    const [isBulkOooModalOpen, setIsBulkOooModalOpen] = useState(false);

    const { hasRole } = useAuth();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [roomsData, summaryData] = await Promise.all([
                housekeepingApi.getRooms(),
                housekeepingApi.getSummary(),
            ]);
            setRooms(roomsData);
            setSummary(summaryData);
            setSelectedRooms(new Set()); // Clear selection on reload
        } catch (error) {
            console.error('Failed to load housekeeping data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRoom = (roomId) => {
        const newSelected = new Set(selectedRooms);
        if (newSelected.has(roomId)) {
            newSelected.delete(roomId);
        } else {
            newSelected.add(roomId);
        }
        setSelectedRooms(newSelected);
    };

    const handleSelectAllFloor = (floor) => {
        const floorRooms = rooms.filter(r => r.floor === floor).map(r => r.id);
        const newSelected = new Set(selectedRooms);
        const allSelected = floorRooms.every(id => newSelected.has(id));

        if (allSelected) {
            floorRooms.forEach(id => newSelected.delete(id));
        } else {
            floorRooms.forEach(id => newSelected.add(id));
        }
        setSelectedRooms(newSelected);
    };

    const handleSelectAllVisible = () => {
        const visibleIds = filteredRooms.map(r => r.id);
        const newSelected = new Set(selectedRooms);
        const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => newSelected.has(id));

        if (allVisibleSelected) {
            visibleIds.forEach(id => newSelected.delete(id));
        } else {
            visibleIds.forEach(id => newSelected.add(id));
        }
        setSelectedRooms(newSelected);
    };

    const handleBulkAction = async (status, reason = '') => {
        if (selectedRooms.size === 0) return;

        try {
            await housekeepingApi.bulkUpdate(Array.from(selectedRooms), status, reason);
            await loadData();
            setIsBulkOooModalOpen(false);
            setOooReason('');
        } catch (error) {
            console.error('Bulk update failed:', error);
            alert('Failed to update rooms: ' + error.message);
        }
    };

    const handleBulkOooSubmit = async () => {
        if (!oooReason.trim()) {
            alert('Please enter a reason for taking rooms out of order');
            return;
        }
        await handleBulkAction('out_of_order', oooReason);
    };


    const handleStatusChange = async (roomId, newStatus, reason = '') => {
        try {
            await housekeepingApi.updateRoom(roomId, newStatus, reason);
            await loadData();
        } catch (error) {
            console.error('Failed to update room:', error);
            alert('Failed to update room: ' + error.message);
        }
    };

    const handleOooSubmit = async () => {
        if (!oooReason.trim()) {
            alert('Please enter a reason for taking the room out of order');
            return;
        }
        await handleStatusChange(oooModal.roomId, 'out_of_order', oooReason);
        setOooModal({ open: false, roomId: null, roomNumber: '' });
        setOooReason('');
    };

    const openOooModal = (roomId, roomNumber) => {
        setOooModal({ open: true, roomId, roomNumber });
    };

    const getFilteredRooms = () => {
        let filtered = rooms;

        if (activeFloor !== 'all') {
            filtered = filtered.filter(room => room.floor === parseInt(activeFloor));
        }

        if (activeStatus !== 'all') {
            filtered = filtered.filter(room => room.status === activeStatus);
        }

        return filtered;
    };

    const getStatusClass = (status) => {
        return status.replace('_', '-');
    };

    const floors = [1, 2, 3];
    const statuses = ['vacant_clean', 'vacant_dirty', 'occupied', 'inspected', 'out_of_order'];
    const filteredRooms = getFilteredRooms();

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="housekeeping-page">
            <div className="page-header">
                <div>
                    <h1>Housekeeping</h1>
                    <p className="text-muted">Manage room cleaning status</p>
                </div>
            </div>

            {summary && (
                <div className="housekeeping-summary">
                    <div className="summary-card">
                        <div className="summary-icon dirty">🧹</div>
                        <div className="summary-content">
                            <div className="summary-value">{summary.total?.dirty || 0}</div>
                            <div className="summary-label">Rooms to Clean</div>
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-icon clean">✨</div>
                        <div className="summary-content">
                            <div className="summary-value">{summary.total?.clean || 0}</div>
                            <div className="summary-label">Cleaned</div>
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="summary-icon occupied">🔵</div>
                        <div className="summary-content">
                            <div className="summary-value">{summary.total?.occupied || 0}</div>
                            <div className="summary-label">Occupied</div>
                        </div>
                    </div>
                    <div className="summary-card ooo">
                        <div className="summary-icon ooo-icon">⚠️</div>
                        <div className="summary-content">
                            <div className="summary-value">{summary.total?.out_of_order || 0}</div>
                            <div className="summary-label">Out of Order</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="filters-row">
                <div className="filter-group">
                    <label className="filter-label">Floor</label>
                    <div className="filter-buttons">
                        <button
                            className={`filter-btn ${activeFloor === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveFloor('all')}
                        >
                            All
                        </button>
                        {floors.map(floor => (
                            <button
                                key={floor}
                                className={`filter-btn ${activeFloor === String(floor) ? 'active' : ''}`}
                                onClick={() => setActiveFloor(String(floor))}
                            >
                                {floor}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="filter-group">
                    <label className="filter-label">Status</label>
                    <div className="filter-buttons">
                        <button
                            className={`filter-btn ${activeStatus === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveStatus('all')}
                        >
                            All
                        </button>
                        {statuses.map(status => (
                            <button
                                key={status}
                                className={`filter-btn ${activeStatus === status ? 'active' : ''} ${getStatusClass(status)}`}
                                onClick={() => setActiveStatus(status)}
                            >
                                {getStatusLabel(status)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="filter-group">
                    <label className="filter-label">Actions</label>
                    <button
                        className="btn btn-secondary filter-btn"
                        onClick={handleSelectAllVisible}
                    >
                        {filteredRooms.length > 0 && filteredRooms.every(r => selectedRooms.has(r.id))
                            ? 'Deselect All'
                            : 'Select All Visible'}
                    </button>
                </div>
            </div>

            {selectedRooms.size > 0 && (
                <div className="bulk-actions-toolbar">
                    <div className="bulk-info">
                        <strong>{selectedRooms.size}</strong> rooms selected
                    </div>
                    <div className="bulk-buttons">
                        <button className="btn btn-success" onClick={() => handleBulkAction('vacant_clean')}>
                            Mark Clean
                        </button>
                        <button className="btn btn-warning" onClick={() => handleBulkAction('vacant_dirty')}>
                            Mark Dirty
                        </button>
                        {hasRole('owner', 'manager') && (
                            <button className="btn btn-danger" onClick={() => setIsBulkOooModalOpen(true)}>
                                Out of Order
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={() => setSelectedRooms(new Set())}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="housekeeping-grid">
                {filteredRooms.map(room => (
                    <div
                        key={room.id}
                        className={`housekeeping-card ${getStatusClass(room.status)} ${selectedRooms.has(room.id) ? 'selected' : ''}`}
                        onClick={() => handleSelectRoom(room.id)}
                    >
                        <div className="hk-card-header">
                            <div className="hk-header-left">
                                <input
                                    type="checkbox"
                                    checked={selectedRooms.has(room.id)}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        handleSelectRoom(room.id);
                                    }}
                                    className="room-checkbox"
                                />
                                <span className="hk-room-number">{room.room_number}</span>
                            </div>
                            <span className={`badge status-${getStatusClass(room.status)}`}>
                                {getStatusLabel(room.status)}
                            </span>
                        </div>
                        <div className="hk-card-body">
                            <div className="hk-room-type">{room.room_type} · Floor {room.floor}</div>
                            {room.guest_name && (
                                <div className="hk-guest">Guest: {room.guest_name}</div>
                            )}
                            {room.status === 'out_of_order' && room.out_of_order_reason && (
                                <div className="hk-ooo-reason">
                                    <strong>Reason:</strong> {room.out_of_order_reason}
                                </div>
                            )}
                        </div>
                        <div className="hk-card-actions">
                            {room.status === 'vacant_dirty' && (
                                <>
                                    <button
                                        className="btn btn-sm btn-success"
                                        onClick={() => handleStatusChange(room.id, 'vacant_clean')}
                                    >
                                        Mark Clean
                                    </button>
                                    {hasRole('owner', 'manager') && (
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => openOooModal(room.id, room.room_number)}
                                        >
                                            OOO
                                        </button>
                                    )}
                                </>
                            )}
                            {room.status === 'vacant_clean' && (
                                <>
                                    {hasRole('owner', 'manager', 'frontdesk') && (
                                        <button
                                            className="btn btn-sm"
                                            style={{ background: 'var(--status-inspected)', color: 'white' }}
                                            onClick={() => handleStatusChange(room.id, 'inspected')}
                                        >
                                            Inspect
                                        </button>
                                    )}
                                    {hasRole('owner', 'manager') && (
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => openOooModal(room.id, room.room_number)}
                                        >
                                            OOO
                                        </button>
                                    )}
                                </>
                            )}
                            {room.status === 'inspected' && hasRole('owner', 'manager') && (
                                <>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => handleStatusChange(room.id, 'vacant_clean')}
                                    >
                                        Reset
                                    </button>
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => openOooModal(room.id, room.room_number)}
                                    >
                                        OOO
                                    </button>
                                </>
                            )}
                            {room.status === 'out_of_order' && hasRole('owner', 'manager') && (
                                <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => handleStatusChange(room.id, 'vacant_dirty')}
                                >
                                    Reactivate
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filteredRooms.length === 0 && (
                <div className="empty-state">
                    <p>No rooms match the selected filters</p>
                </div>
            )}

            {/* Bulk Out of Order Modal */}
            {isBulkOooModalOpen && (
                <div className="modal-overlay" onClick={() => setIsBulkOooModalOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Take {selectedRooms.size} Rooms Out of Order</h3>
                            <button className="modal-close" onClick={() => setIsBulkOooModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Reason *</label>
                                <textarea
                                    className="form-input form-textarea"
                                    value={oooReason}
                                    onChange={e => setOooReason(e.target.value)}
                                    placeholder="Enter reason for out of order status (e.g., General Maintenance, AC Repair)"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setIsBulkOooModalOpen(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-danger" onClick={handleBulkOooSubmit}>
                                Mark Out of Order
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Out of Order Modal */}
            {oooModal.open && (
                <div className="modal-overlay" onClick={() => setOooModal({ open: false, roomId: null, roomNumber: '' })}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Take Room {oooModal.roomNumber} Out of Order</h3>
                            <button className="modal-close" onClick={() => setOooModal({ open: false, roomId: null, roomNumber: '' })}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Reason *</label>
                                <textarea
                                    className="form-input form-textarea"
                                    value={oooReason}
                                    onChange={e => setOooReason(e.target.value)}
                                    placeholder="Enter reason for out of order status (e.g., AC repair, plumbing issue)"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setOooModal({ open: false, roomId: null, roomNumber: '' })}>
                                Cancel
                            </button>
                            <button className="btn btn-danger" onClick={handleOooSubmit}>
                                Mark Out of Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Housekeeping;
