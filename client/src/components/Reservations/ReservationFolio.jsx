import { useState, useEffect } from 'react';
import { reservationsApi, formatDate, formatCurrency, getRoomTypeLabel, getToday } from '../../utils/api';
import './ReservationFolio.css';

const ReservationFolio = ({ reservationId, onClose, onUpdate }) => {
    const [reservation, setReservation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('details');
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({});
    const [paymentAmount, setPaymentAmount] = useState('');

    useEffect(() => {
        loadReservation();
    }, [reservationId]);

    const loadReservation = async () => {
        try {
            const data = await reservationsApi.getById(reservationId);
            setReservation(data);
            setEditData({
                checkInDate: data.check_in_date?.split('T')[0],
                checkOutDate: data.check_out_date?.split('T')[0],
                nightlyRate: data.nightly_rate,
                numGuests: data.num_guests,
                notes: data.notes || '',
                earlyCheckinFee: data.early_checkin_fee || 0,
                lateCheckoutFee: data.late_checkout_fee || 0,
            });
        } catch (error) {
            console.error('Failed to load reservation:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateNights = () => {
        if (!reservation) return 0;
        const checkIn = new Date(reservation.check_in_date);
        const checkOut = new Date(reservation.check_out_date);
        return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    };

    const calculateTotal = () => {
        const nights = calculateNights();
        const roomCharges = nights * (editData.nightlyRate || reservation?.nightly_rate || 0);
        const earlyFee = parseFloat(editData.earlyCheckinFee) || 0;
        const lateFee = parseFloat(editData.lateCheckoutFee) || 0;
        return roomCharges + earlyFee + lateFee;
    };

    const handleSave = async () => {
        try {
            await reservationsApi.update(reservationId, editData);
            setEditMode(false);
            await loadReservation();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update reservation:', error);
            alert('Failed to update reservation: ' + error.message);
        }
    };

    const handleCheckIn = async () => {
        try {
            await reservationsApi.checkIn(reservationId);
            await loadReservation();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to check in:', error);
            alert('Failed to check in: ' + error.message);
        }
    };

    const handleCheckOut = async () => {
        try {
            await reservationsApi.checkOut(reservationId, { paymentStatus: 'paid' });
            await loadReservation();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to check out:', error);
            alert('Failed to check out: ' + error.message);
        }
    };

    const handleAddPayment = async () => {
        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0) return;

        try {
            await reservationsApi.addPayment(reservationId, {
                amount,
                method: 'cash',
            });
            setPaymentAmount('');
            await loadReservation();
        } catch (error) {
            console.error('Failed to add payment:', error);
            alert('Failed to add payment: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div className="modal-overlay">
                <div className="folio-modal">
                    <div className="loading"><div className="spinner"></div></div>
                </div>
            </div>
        );
    }

    if (!reservation) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="folio-modal" onClick={e => e.stopPropagation()}>
                    <p>Reservation not found</p>
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        );
    }

    const nights = calculateNights();
    const total = calculateTotal();
    const paid = parseFloat(reservation.amount_paid) || 0;
    const balance = total - paid;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="folio-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="folio-header">
                    <div className="folio-title">
                        <h2>Reservation Folio</h2>
                        <span className="confirmation">{reservation.confirmation_number}</span>
                    </div>
                    <div className="folio-header-right">
                        <span className={`badge badge-lg ${reservation.status === 'checked_in' ? 'badge-success' : reservation.status === 'confirmed' ? 'badge-warning' : 'badge-info'}`}>
                            {reservation.status.replace('_', ' ')}
                        </span>
                        <button className="modal-close" onClick={onClose}>×</button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="folio-tabs">
                    <button
                        className={`folio-tab ${activeTab === 'details' ? 'active' : ''}`}
                        onClick={() => setActiveTab('details')}
                    >
                        Details
                    </button>
                    <button
                        className={`folio-tab ${activeTab === 'charges' ? 'active' : ''}`}
                        onClick={() => setActiveTab('charges')}
                    >
                        Charges
                    </button>
                    <button
                        className={`folio-tab ${activeTab === 'guest' ? 'active' : ''}`}
                        onClick={() => setActiveTab('guest')}
                    >
                        Guest
                    </button>
                </div>

                {/* Content */}
                <div className="folio-content">
                    {activeTab === 'details' && (
                        <div className="folio-details">
                            <div className="detail-section">
                                <h4>Stay Information</h4>
                                {editMode ? (
                                    <div className="edit-grid">
                                        <div className="form-group">
                                            <label>Check In</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={editData.checkInDate || ''}
                                                onChange={e => setEditData({ ...editData, checkInDate: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Check Out</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={editData.checkOutDate || ''}
                                                onChange={e => setEditData({ ...editData, checkOutDate: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Nightly Rate</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={editData.nightlyRate || ''}
                                                onChange={e => setEditData({ ...editData, nightlyRate: e.target.value })}
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Guests</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={editData.numGuests || ''}
                                                onChange={e => setEditData({ ...editData, numGuests: e.target.value })}
                                                min="1" max="6"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="info-grid">
                                        <div className="info-item">
                                            <span className="info-label">Check In</span>
                                            <span className="info-value">{formatDate(reservation.check_in_date)}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Check Out</span>
                                            <span className="info-value">{formatDate(reservation.check_out_date)}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Nights</span>
                                            <span className="info-value">{nights}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Guests</span>
                                            <span className="info-value">{reservation.num_guests}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="detail-section">
                                <h4>Room</h4>
                                <div className="room-info">
                                    <span className="room-number">{reservation.room_number}</span>
                                    <span className="room-type">{getRoomTypeLabel(reservation.room_type)}</span>
                                    <span className="room-floor">Floor {reservation.floor}</span>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h4>Notes</h4>
                                {editMode ? (
                                    <textarea
                                        className="form-input form-textarea"
                                        value={editData.notes || ''}
                                        onChange={e => setEditData({ ...editData, notes: e.target.value })}
                                        rows={3}
                                        placeholder="Add notes..."
                                    />
                                ) : (
                                    <p className="notes-text">{reservation.notes || 'No notes'}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'charges' && (
                        <div className="folio-charges">
                            <div className="charges-list">
                                <div className="charge-row">
                                    <span>Room ({nights} nights × {formatCurrency(editData.nightlyRate || reservation.nightly_rate)})</span>
                                    <span>{formatCurrency(nights * (editData.nightlyRate || reservation.nightly_rate))}</span>
                                </div>
                                {editMode ? (
                                    <>
                                        <div className="charge-row editable">
                                            <span>Early Check-in Fee</span>
                                            <input
                                                type="number"
                                                className="form-input form-input-sm"
                                                value={editData.earlyCheckinFee || ''}
                                                onChange={e => setEditData({ ...editData, earlyCheckinFee: e.target.value })}
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="charge-row editable">
                                            <span>Late Check-out Fee</span>
                                            <input
                                                type="number"
                                                className="form-input form-input-sm"
                                                value={editData.lateCheckoutFee || ''}
                                                onChange={e => setEditData({ ...editData, lateCheckoutFee: e.target.value })}
                                                step="0.01"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {parseFloat(reservation.early_checkin_fee) > 0 && (
                                            <div className="charge-row">
                                                <span>Early Check-in Fee</span>
                                                <span>{formatCurrency(reservation.early_checkin_fee)}</span>
                                            </div>
                                        )}
                                        {parseFloat(reservation.late_checkout_fee) > 0 && (
                                            <div className="charge-row">
                                                <span>Late Check-out Fee</span>
                                                <span>{formatCurrency(reservation.late_checkout_fee)}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="charge-row total">
                                    <span>Total</span>
                                    <span>{formatCurrency(total)}</span>
                                </div>
                            </div>

                            <div className="payment-section">
                                <h4>Payments</h4>
                                <div className="payment-summary">
                                    <div className="payment-row">
                                        <span>Paid</span>
                                        <span className="text-success">{formatCurrency(paid)}</span>
                                    </div>
                                    <div className="payment-row balance">
                                        <span>Balance Due</span>
                                        <span className={balance > 0 ? 'text-danger' : 'text-success'}>
                                            {formatCurrency(balance)}
                                        </span>
                                    </div>
                                </div>

                                {balance > 0 && (
                                    <div className="add-payment">
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="Amount"
                                            value={paymentAmount}
                                            onChange={e => setPaymentAmount(e.target.value)}
                                            step="0.01"
                                        />
                                        <button className="btn btn-success" onClick={handleAddPayment}>
                                            Add Payment
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'guest' && (
                        <div className="folio-guest">
                            <div className="detail-section">
                                <h4>Guest Information</h4>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Name</span>
                                        <span className="info-value">{reservation.first_name} {reservation.last_name}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Phone</span>
                                        <span className="info-value">{reservation.phone || '-'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Email</span>
                                        <span className="info-value">{reservation.email || '-'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">ID</span>
                                        <span className="info-value">{reservation.id_number || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h4>Vehicle</h4>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Make/Model</span>
                                        <span className="info-value">
                                            {reservation.vehicle_make} {reservation.vehicle_model}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Color</span>
                                        <span className="info-value">{reservation.vehicle_color || '-'}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Plate</span>
                                        <span className="info-value">{reservation.vehicle_plate || '-'} {reservation.vehicle_state}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="folio-footer">
                    {editMode ? (
                        <>
                            <button className="btn btn-secondary" onClick={() => setEditMode(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleSave}>
                                Save Changes
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                                ✏️ Edit
                            </button>
                            {reservation.status === 'confirmed' && (
                                <button className="btn btn-success" onClick={handleCheckIn}>
                                    Check In
                                </button>
                            )}
                            {reservation.status === 'checked_in' && (
                                <button className="btn btn-primary" onClick={handleCheckOut}>
                                    Check Out
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReservationFolio;
