import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { folioApi, roomsApi, reservationsApi, paymentsApi, formatDate, formatCurrency, getRoomTypeLabel } from '../utils/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './FolioPage.css';

// Stripe CardElement styling (dark theme)
const CARD_ELEMENT_OPTIONS = {
    style: {
        base: {
            color: '#e2e8f0',
            fontFamily: '"Inter", system-ui, sans-serif',
            fontSize: '16px',
            '::placeholder': { color: '#64748b' },
        },
        invalid: {
            color: '#f87171',
        },
    },
};

// Stripe card payment form component (must be inside Elements provider)
const StripeCardForm = ({ amount, reservationId, guestName, confirmationNumber, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [cardError, setCardError] = useState('');
    const [succeeded, setSucceeded] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setProcessing(true);
        setCardError('');

        try {
            // 1. Create PaymentIntent on backend
            const { clientSecret } = await paymentsApi.createIntent(
                amount, reservationId, guestName, confirmationNumber
            );

            // 2. Confirm payment with Stripe
            const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement),
                },
            });

            if (error) {
                setCardError(error.message);
                setProcessing(false);
            } else if (paymentIntent.status === 'succeeded') {
                setSucceeded(true);
                // 3. Record in folio
                await onSuccess(paymentIntent.id);
            }
        } catch (err) {
            setCardError(err.message || 'Payment failed');
            setProcessing(false);
        }
    };

    if (succeeded) {
        return (
            <div className="stripe-success">
                <div className="success-icon">✅</div>
                <h4>Payment Successful!</h4>
                <p>{formatCurrency(amount)} charged to card</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="stripe-card-wrapper">
                <label className="stripe-label">Card Details</label>
                <div className="stripe-card-element">
                    <CardElement options={CARD_ELEMENT_OPTIONS} />
                </div>
                {cardError && <div className="stripe-error">{cardError}</div>}
                <div className="stripe-test-hint">
                    💡 Test card: <code>4242 4242 4242 4242</code> | Exp: <code>12/34</code> | CVC: <code>123</code>
                </div>
            </div>
            <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={processing}>
                    Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={!stripe || processing}>
                    {processing ? (
                        <><span className="spinner-sm"></span> Processing...</>
                    ) : (
                        `💳 Charge ${formatCurrency(amount)}`
                    )}
                </button>
            </div>
            <div className="stripe-powered">
                🔒 Secured by <strong>Stripe</strong>
            </div>
        </form>
    );
};

const FolioPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [folio, setFolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stripePromise, setStripePromise] = useState(null);

    // Modal states
    const [showChargeModal, setShowChargeModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [cancelReason, setCancelReason] = useState('');

    // Notes State
    const [notes, setNotes] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    const [notesDirty, setNotesDirty] = useState(false);

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

    // Form states
    const [chargeForm, setChargeForm] = useState({ category: 'extra', description: '', amount: '', quantity: 1 });
    const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', reference: '' });
    const [selectedRoomId, setSelectedRoomId] = useState('');

    // Charge presets by category
    const chargePresets = {
        deposit: ['Security Deposit', 'Key Deposit'],
        extra: ['Extra Person Fee', 'Pet Fee', 'Rollaway Bed', 'Crib'],
        purchase: ['Snacks', 'Drinks', 'Toiletries', 'Phone Charger'],
        damage: ['Smoking Fee', 'Damage Repair', 'Missing Items'],
        fee: ['Early Check-in', 'Late Check-out', 'Parking Fee'],
    };

    useEffect(() => {
        loadFolio();
    }, [id]);

    const loadFolio = async () => {
        try {
            setLoading(true);
            const data = await folioApi.get(id);
            setFolio(data);

            // Initialize notes
            setNotes(data.reservation.notes || '');
            setInternalNotes(data.reservation.internal_notes || '');
            setNotesDirty(false);

            setError(null);
        } catch (err) {
            console.error('Failed to load folio:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveNotes = async () => {
        try {
            await reservationsApi.update(folio.reservation.id, {
                notes,
                internalNotes
            });
            setNotesDirty(false);
            // Optional: Show success message or toast
        } catch (error) {
            console.error('Failed to save notes:', error);
            alert('Failed to save notes');
        }
    };

    const loadAvailableRooms = async () => {
        if (!folio) return;
        try {
            const rooms = await roomsApi.getAvailable(
                folio.reservation.check_in_date.split('T')[0],
                folio.reservation.check_out_date.split('T')[0]
            );
            setAvailableRooms(rooms.filter(r => r.id !== folio.reservation.room_id));
        } catch (err) {
            console.error('Failed to load rooms:', err);
        }
    };

    const handleAddCharge = async (e) => {
        e.preventDefault();
        try {
            await folioApi.addCharge(id, chargeForm);
            setShowChargeModal(false);
            setChargeForm({ category: 'extra', description: '', amount: '', quantity: 1 });
            loadFolio();
        } catch (err) {
            alert('Failed to add charge: ' + err.message);
        }
    };

    const handleVoidCharge = async (chargeId) => {
        if (!confirm('Void this charge?')) return;
        try {
            await folioApi.voidCharge(id, chargeId);
            loadFolio();
        } catch (err) {
            alert('Failed to void charge: ' + err.message);
        }
    };

    // Load Stripe config when card method is selected
    const loadStripeConfig = async () => {
        if (!stripePromise) {
            try {
                const config = await paymentsApi.getConfig();
                if (config.publishableKey && !config.publishableKey.includes('REPLACE')) {
                    setStripePromise(loadStripe(config.publishableKey));
                }
            } catch (err) {
                console.error('Failed to load Stripe config:', err);
            }
        }
    };

    const handleAddPayment = async (e) => {
        e.preventDefault();
        // For card payments with Stripe, handled by StripeCardForm component
        if (paymentForm.method === 'card' && stripePromise) return;
        try {
            await folioApi.addPayment(id, paymentForm);
            setShowPaymentModal(false);
            setPaymentForm({ amount: '', method: 'cash', reference: '' });
            loadFolio();
        } catch (err) {
            alert('Failed to add payment: ' + err.message);
        }
    };

    const handleStripeSuccess = async (stripePaymentId) => {
        try {
            await folioApi.addPayment(id, {
                amount: paymentForm.amount,
                method: 'card',
                reference: stripePaymentId,
            });
            setTimeout(() => {
                setShowPaymentModal(false);
                setPaymentForm({ amount: '', method: 'cash', reference: '' });
                loadFolio();
            }, 1500);
        } catch (err) {
            alert('Payment succeeded but recording failed: ' + err.message);
        }
    };

    const handleChangeRoom = async () => {
        if (!selectedRoomId) return;
        try {
            await folioApi.changeRoom(id, selectedRoomId);
            setShowRoomModal(false);
            setSelectedRoomId('');
            loadFolio();
        } catch (err) {
            alert('Failed to change room: ' + err.message);
        }
    };



    const handleGenerateRoomCharges = async () => {
        try {
            await folioApi.generateRoomCharges(id);
            loadFolio();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleCheckIn = async () => {
        try {
            await reservationsApi.checkIn(id);
            loadFolio();
        } catch (err) {
            alert('Check-in failed: ' + err.message);
        }
    };

    const handleCheckOut = async () => {
        if (folio.summary.balance > 0) {
            if (!confirm(`Guest still owes ${formatCurrency(folio.summary.balance)}. Continue with check-out?`)) {
                return;
            }
        }
        try {
            await reservationsApi.checkOut(id);
            loadFolio();
        } catch (err) {
            alert('Check-out failed: ' + err.message);
        }
    };

    const openCancelModal = () => {
        setCancelReason('');
        setShowCancelModal(true);
    };

    const handleConfirmCancel = async () => {
        if (!cancelReason) {
            alert('Please select a cancellation reason');
            return;
        }
        try {
            await reservationsApi.cancel(id, cancelReason);
            navigate('/reservations');
        } catch (err) {
            alert('Failed to cancel reservation: ' + err.message);
        }
    };

    const openRoomModal = () => {
        loadAvailableRooms();
        setShowRoomModal(true);
    };

    const calculateNights = () => {
        if (!folio) return 0;
        const checkIn = new Date(folio.reservation.check_in_date);
        const checkOut = new Date(folio.reservation.check_out_date);
        return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    };

    if (loading) {
        return <div className="loading"><div className="spinner"></div></div>;
    }

    if (error || !folio) {
        return (
            <div className="folio-error">
                <h2>Folio Not Found</h2>
                <p>{error || 'Unable to load reservation folio'}</p>
                <button className="btn btn-primary" onClick={() => navigate('/reservations')}>
                    Back to Reservations
                </button>
            </div>
        );
    }

    const { reservation, charges, payments } = folio;
    const nights = calculateNights();

    // Check if room charge exists
    const hasRoomCharge = charges.some(c => c.category === 'room');
    const pendingRoomCharge = !hasRoomCharge && reservation.status !== 'cancelled' ? {
        amount: parseFloat(reservation.nightly_rate),
        quantity: nights,
        total: parseFloat(reservation.nightly_rate) * nights,
        description: `Room Charge (${nights} nights) - Pending`,
        isPending: true
    } : null;

    // Calculate summary manually to ensure accuracy
    let totalCharges = charges.reduce((sum, charge) => sum + (parseFloat(charge.amount) * charge.quantity), 0);

    // Add pending charge to total
    if (pendingRoomCharge) {
        totalCharges += pendingRoomCharge.total;
    }

    const totalPayments = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const balance = totalCharges - totalPayments;

    const summary = {
        totalCharges,
        totalPayments,
        balance
    };

    return (
        <div className="folio-page">
            {/* Header */}
            <div className="folio-page-header">
                <div className="folio-title-section">
                    <button className="btn btn-icon" onClick={() => navigate(-1)}>←</button>
                    <div>
                        <h1>{reservation.first_name} {reservation.last_name}</h1>
                        <span className="confirmation-number">#{reservation.confirmation_number}</span>
                    </div>
                </div>
                <div className="folio-header-actions">
                    <span className={`status-badge status-${reservation.status}`}>
                        {reservation.status.replace('_', ' ')}
                    </span>
                    {reservation.status === 'confirmed' && (
                        <>
                            <button className="btn btn-danger" onClick={openCancelModal}>Cancel</button>
                            <button className="btn btn-success" onClick={handleCheckIn}>Check In</button>
                        </>
                    )}
                    {reservation.status === 'checked_in' && (
                        <button className="btn btn-primary" onClick={handleCheckOut}>Check Out</button>
                    )}
                </div>
            </div>

            <div className="folio-layout">
                {/* Left Panel - Details */}
                <div className="folio-left-panel">
                    <div className="folio-card">
                        <h3>📅 Stay Details</h3>
                        <div className="detail-grid">
                            <div className="detail-item">
                                <span className="label">Check In</span>
                                <span className="value">{formatDate(reservation.check_in_date)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Check Out</span>
                                <span className="value">{formatDate(reservation.check_out_date)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Nights</span>
                                <span className="value">{nights}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Guests</span>
                                <span className="value">{reservation.num_guests}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Rate</span>
                                <span className="value">{formatCurrency(reservation.nightly_rate)}/night</span>
                            </div>
                        </div>
                    </div>

                    <div className="folio-card">
                        <div className="card-header-row">
                            <h3>🚪 Room</h3>
                            <button className="btn btn-sm btn-secondary" onClick={openRoomModal}>Change</button>
                        </div>
                        <div className="room-display">
                            <span className="room-number-large">{reservation.room_number}</span>
                            <span className="room-details">
                                {getRoomTypeLabel(reservation.room_type)} · Floor {reservation.floor}
                            </span>
                        </div>
                    </div>

                    <div className="folio-card">
                        <h3>👤 Guest</h3>
                        <div className="guest-info">
                            <p><strong>{reservation.first_name} {reservation.last_name}</strong></p>
                            <p>📞 {reservation.phone || 'No phone'}</p>
                            <p>📧 {reservation.email || 'No email'}</p>
                            {reservation.id_number && <p>🪪 {reservation.id_number}</p>}
                        </div>
                        {reservation.vehicle_make && (
                            <div className="vehicle-info">
                                <p>🚗 {reservation.vehicle_color} {reservation.vehicle_make} {reservation.vehicle_model}</p>
                                <p>🔢 {reservation.vehicle_plate} ({reservation.vehicle_state})</p>
                            </div>
                        )}
                    </div>

                    <div className="folio-card">
                        <div className="card-header-row" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>📝 Notes & Comments</h3>
                            {notesDirty && (
                                <button className="btn btn-sm btn-primary" onClick={handleSaveNotes}>
                                    Save
                                </button>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="text-muted" style={{ fontSize: '0.85rem' }}>Reservation Notes (Visible on Confirmation)</label>
                            <textarea
                                className="form-input"
                                value={notes}
                                onChange={(e) => {
                                    setNotes(e.target.value);
                                    setNotesDirty(true);
                                }}
                                rows={3}
                                placeholder="General notes about the reservation..."
                                style={{ resize: 'vertical', minHeight: '60px' }}
                            />
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="text-muted" style={{ fontSize: '0.85rem', color: '#b7791f' }}>Internal Comments (Staff Only)</label>
                            <textarea
                                className="form-input"
                                value={internalNotes}
                                onChange={(e) => {
                                    setInternalNotes(e.target.value);
                                    setNotesDirty(true);
                                }}
                                rows={3}
                                placeholder="Shift notes, alerts, internal info..."
                                style={{
                                    resize: 'vertical',
                                    minHeight: '60px',
                                    backgroundColor: '#fffbeb',
                                    borderColor: '#fbd38d',
                                    color: '#744210'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Panel - Charges & Payments */}
                <div className="folio-right-panel">
                    <div className="folio-card charges-card">
                        <div className="card-header-row">
                            <h3>💳 Charges</h3>
                            <div className="btn-group">
                                {charges.filter(c => c.category === 'room').length === 0 && (
                                    <button className="btn btn-sm btn-info" onClick={handleGenerateRoomCharges}>
                                        + Room
                                    </button>
                                )}
                                <button className="btn btn-sm btn-primary" onClick={() => setShowChargeModal(true)}>
                                    + Add
                                </button>
                            </div>
                        </div>

                        <div className="charges-list">
                            {/* Pending Room Charge */}
                            {pendingRoomCharge && (
                                <div className="charge-item pending-charge">
                                    <div className="charge-info">
                                        <span className="charge-category cat-room">
                                            Room
                                        </span>
                                        <span className="charge-desc">
                                            {pendingRoomCharge.description}
                                            <span className="badge badge-warning ml-sm">Pending</span>
                                        </span>
                                    </div>
                                    <div className="charge-amount">
                                        {formatCurrency(pendingRoomCharge.total)}
                                        <button
                                            className="btn btn-sm btn-success ml-sm"
                                            onClick={handleGenerateRoomCharges}
                                            title="Post Charge Now"
                                        >
                                            Post
                                        </button>
                                    </div>
                                </div>
                            )}

                            {charges.length === 0 && !pendingRoomCharge ? (
                                <p className="empty-msg">No charges yet</p>
                            ) : (
                                charges.map(charge => (
                                    <div key={charge.id} className="charge-item">
                                        <div className="charge-info">
                                            <span className={`charge-category cat-${charge.category}`}>
                                                {charge.category}
                                            </span>
                                            <span className="charge-desc">{charge.description}</span>
                                            {charge.quantity > 1 && <span className="charge-qty">×{charge.quantity}</span>}
                                        </div>
                                        <div className="charge-amount">
                                            {formatCurrency(charge.amount * charge.quantity)}
                                            <button
                                                className="btn-void"
                                                onClick={() => handleVoidCharge(charge.id)}
                                                title="Void"
                                            >×</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="charges-total">
                            <span>Total Charges</span>
                            <span>{formatCurrency(summary.totalCharges)}</span>
                        </div>
                    </div>

                    <div className="folio-card payments-card">
                        <div className="card-header-row">
                            <h3>💵 Payments</h3>
                            <button className="btn btn-sm btn-success" onClick={() => {
                                setPaymentForm({ ...paymentForm, amount: summary.balance.toFixed(2) });
                                setShowPaymentModal(true);
                            }}>
                                + Add
                            </button>
                        </div>

                        <div className="payments-list">
                            {payments.length === 0 ? (
                                <p className="empty-msg">No payments yet</p>
                            ) : (
                                payments.map(payment => (
                                    <div key={payment.id} className="payment-item">
                                        <div className="payment-info">
                                            <span className={`payment-method method-${payment.method}`}>
                                                {payment.method}
                                            </span>
                                            <span className="payment-date">
                                                {formatDate(payment.date_received)}
                                            </span>
                                            {payment.reference && (
                                                <span className="payment-ref">{payment.reference}</span>
                                            )}
                                        </div>
                                        <span className="payment-amount">{formatCurrency(payment.amount)}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="payments-total">
                            <span>Total Paid</span>
                            <span className="text-success">{formatCurrency(summary.totalPayments)}</span>
                        </div>
                    </div>

                    <div className="folio-card balance-card">
                        <div className={`balance-display ${summary.balance <= 0 ? 'paid' : 'due'}`}>
                            <span className="balance-label">
                                {summary.balance <= 0 ? '✓ PAID IN FULL' : 'BALANCE DUE'}
                            </span>
                            <span className="balance-amount">{formatCurrency(Math.abs(summary.balance))}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Charge Modal */}
            {showChargeModal && (
                <div className="modal-overlay" onClick={() => setShowChargeModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add Charge</h3>
                            <button className="modal-close" onClick={() => setShowChargeModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleAddCharge}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Category</label>
                                    <select
                                        className="form-input form-select"
                                        value={chargeForm.category}
                                        onChange={e => setChargeForm({ ...chargeForm, category: e.target.value, description: '' })}
                                    >
                                        <option value="deposit">Deposit</option>
                                        <option value="extra">Extra</option>
                                        <option value="purchase">Purchase</option>
                                        <option value="damage">Damage</option>
                                        <option value="fee">Fee</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <select
                                        className="form-input form-select"
                                        value={chargeForm.description}
                                        onChange={e => setChargeForm({ ...chargeForm, description: e.target.value })}
                                    >
                                        <option value="">Select or type below...</option>
                                        {(chargePresets[chargeForm.category] || []).map(preset => (
                                            <option key={preset} value={preset}>{preset}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        className="form-input mt-sm"
                                        placeholder="Or enter custom description"
                                        value={chargeForm.description}
                                        onChange={e => setChargeForm({ ...chargeForm, description: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Amount ($)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={chargeForm.amount}
                                            onChange={e => setChargeForm({ ...chargeForm, amount: e.target.value })}
                                            step="0.01"
                                            min="0"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Qty</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={chargeForm.quantity}
                                            onChange={e => setChargeForm({ ...chargeForm, quantity: parseInt(e.target.value) })}
                                            min="1"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowChargeModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Charge</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Payment Modal */}
            {showPaymentModal && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add Payment</h3>
                            <button className="modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Amount ($)</label>
                                <input
                                    type="number"
                                    className="form-input form-input-lg"
                                    value={paymentForm.amount}
                                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    step="0.01"
                                    min="0.01"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Method</label>
                                <div className="payment-methods">
                                    {['cash', 'card', 'check'].map(method => (
                                        <button
                                            key={method}
                                            type="button"
                                            className={`method-btn ${paymentForm.method === method ? 'active' : ''}`}
                                            onClick={() => {
                                                setPaymentForm({ ...paymentForm, method });
                                                if (method === 'card') loadStripeConfig();
                                            }}
                                        >
                                            {method === 'cash' ? '💵' : method === 'card' ? '💳' : '📄'} {method}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Stripe Card Payment */}
                            {paymentForm.method === 'card' && paymentForm.amount > 0 && stripePromise && (
                                <Elements stripe={stripePromise}>
                                    <StripeCardForm
                                        amount={parseFloat(paymentForm.amount)}
                                        reservationId={id}
                                        guestName={`${reservation.first_name} ${reservation.last_name}`}
                                        confirmationNumber={reservation.confirmation_number}
                                        onSuccess={handleStripeSuccess}
                                        onCancel={() => setShowPaymentModal(false)}
                                    />
                                </Elements>
                            )}

                            {/* Stripe not configured fallback */}
                            {paymentForm.method === 'card' && !stripePromise && (
                                <div className="stripe-not-configured">
                                    <p>⚠️ Stripe is not configured yet.</p>
                                    <p className="text-muted">Add your Stripe test keys to <code>.env</code> and restart the server.</p>
                                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                                        <label>Last 4 Digits (manual)</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={paymentForm.reference}
                                            onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                                            placeholder="1234"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Check number input */}
                            {paymentForm.method === 'check' && (
                                <div className="form-group">
                                    <label>Check Number</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={paymentForm.reference}
                                        onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                                        placeholder="Check #"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer for non-Stripe payments */}
                        {(paymentForm.method !== 'card' || !stripePromise) && (
                            <form onSubmit={handleAddPayment}>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-success">Record Payment</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Change Room Modal */}
            {showRoomModal && (
                <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Change Room</h3>
                            <button className="modal-close" onClick={() => setShowRoomModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p className="current-room">
                                Current: <strong>{reservation.room_number}</strong> ({getRoomTypeLabel(reservation.room_type)})
                            </p>
                            <div className="form-group">
                                <label>Move to Room</label>
                                <select
                                    className="form-input form-select"
                                    value={selectedRoomId}
                                    onChange={e => setSelectedRoomId(e.target.value)}
                                >
                                    <option value="">Select new room...</option>
                                    {availableRooms.map(room => (
                                        <option key={room.id} value={room.id}>
                                            {room.room_number} - {getRoomTypeLabel(room.room_type)} (Floor {room.floor})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {availableRooms.length === 0 && (
                                <p className="text-muted">No available rooms for these dates</p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowRoomModal(false)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleChangeRoom}
                                disabled={!selectedRoomId}
                            >
                                Change Room
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Cancel Reservation</h3>
                            <button className="modal-close" onClick={() => setShowCancelModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to cancel this reservation?</p>
                            <div className="form-group">
                                <label>Reason for Cancellation *</label>
                                <select
                                    className="form-input form-select"
                                    value={cancelReason}
                                    onChange={e => setCancelReason(e.target.value)}
                                >
                                    <option value="">Select a reason...</option>
                                    {cancellationReasons.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>Go Back</button>
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

export default FolioPage;
