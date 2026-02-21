import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nightAuditApi, formatDate, formatCurrency, getToday } from '../utils/api';
import './NightAudit.css';

const NightAudit = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);
    const [history, setHistory] = useState([]);

    // Execution state
    const [isRunning, setIsRunning] = useState(false);
    const [auditComplete, setAuditComplete] = useState(false);
    const [auditResult, setAuditResult] = useState(null);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [previewRes, historyRes] = await Promise.all([
                nightAuditApi.getPreview(),
                nightAuditApi.getHistory()
            ]);

            setPreview(previewRes);
            setHistory(historyRes);

            // If already audited today, show completion state immediately
            if (previewRes.alreadyAudited && previewRes.previousAudit) {
                setAuditComplete(true);
                setAuditResult({
                    audit: previewRes.previousAudit,
                    summary: {
                        revenuePosted: previewRes.previousAudit.revenue_posted,
                        noShowsMarked: previewRes.previousAudit.no_shows,
                        roomsReset: previewRes.previousAudit.occupied_rooms
                    }
                });
            }
        } catch (err) {
            console.error('Failed to load night audit data:', err);
            setError('Failed to connect to server. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleRunAudit = async () => {
        if (!window.confirm('Are you sure you want to run the Night Audit? This will post room charges, mark no-shows, and reset housekeeping status for occupied rooms. This action cannot be undone.')) {
            return;
        }

        try {
            setIsRunning(true);
            setError(null);

            const result = await nightAuditApi.runAudit(notes);

            setAuditResult(result);
            setAuditComplete(true);

            // Refresh history
            const historyRes = await nightAuditApi.getHistory();
            setHistory(historyRes);

        } catch (err) {
            console.error('Night audit failed:', err);
            setError(err.message || 'The Night Audit failed to process fully. Please check logs.');
        } finally {
            setIsRunning(false);
        }
    };

    if (loading && !preview) {
        return <div className="loading">Loading audit data...</div>;
    }

    return (
        <div className="night-audit-page fade-in">
            <div className="night-audit-header">
                <h1>Night Audit</h1>
                <p>Close the day, post room charges, and reset property status</p>
            </div>

            {error && <div className="alert alert-danger mb-4">{error}</div>}

            {auditComplete ? (
                /* ─── SUCCESS / ALREADY RUN STATE ─── */
                <div className="audit-success-view">
                    <div className="audit-status-banner">
                        <div className="status-icon">✅</div>
                        <div>
                            <h2>Night Audit Complete</h2>
                            <p>The business day {formatDate(preview?.auditDate || getToday())} has been successfully closed.</p>
                        </div>
                    </div>

                    <div className="audit-dashboard-grid">
                        <div className="audit-card success">
                            <h3>Room Revenue Posted</h3>
                            <div className="audit-metric">{formatCurrency(auditResult?.summary?.revenuePosted || auditResult?.audit?.revenue_posted || 0)}</div>
                            <div className="audit-subtext">Automatically posted to {auditResult?.summary?.roomsReset || auditResult?.audit?.occupied_rooms || 0} checked-in folios</div>
                        </div>

                        <div className="audit-card">
                            <h3>No-Shows Marked</h3>
                            <div className="audit-metric">{auditResult?.summary?.noShowsMarked || auditResult?.audit?.no_shows || 0}</div>
                            <div className="audit-subtext">Confirmed reservations that did not arrive</div>
                        </div>

                        <div className="audit-card">
                            <h3>Occupancy Snapshot</h3>
                            <div className="audit-metric">{auditResult?.audit?.occupancy_pct || 0}%</div>
                            <div className="audit-subtext">{auditResult?.audit?.occupied_rooms} of {auditResult?.audit?.total_rooms} available rooms</div>
                        </div>

                        <div className="audit-card">
                            <h3>Total Daily Revenue</h3>
                            <div className="audit-metric">{formatCurrency(auditResult?.audit?.total_revenue || 0)}</div>
                            <div className="audit-subtext">Includes rooms, extras, and fees</div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ─── PREVIEW & EXECUTION STATE ─── */
                <div className="audit-preview-view">
                    <div className="audit-dashboard-grid">
                        <div className="audit-card">
                            <h3>Rooms to Charge</h3>
                            <div className="audit-metric">{preview.chargesToPost}</div>
                            <div className="audit-subtext">Totaling {formatCurrency(preview.stats.roomChargeTotal)} revenue</div>
                        </div>

                        <div className="audit-card warning">
                            <h3>No-Show Candidates</h3>
                            <div className="audit-metric">{preview.noShowCandidates.length}</div>
                            <div className="audit-subtext">Arrivals that haven't checked in yet</div>
                        </div>

                        <div className="audit-card">
                            <h3>Current Occupancy</h3>
                            <div className="audit-metric">{preview.stats.occupancyPct}%</div>
                            <div className="audit-subtext">{preview.stats.occupiedRooms} occupied out of {preview.stats.totalRooms} total</div>
                        </div>
                    </div>

                    {(preview.stats.dirtyRooms > 0 || preview.stats.todayCheckOuts > 0) && (
                        <div className="audit-warnings">
                            <h4>⚠️ Pre-Audit Warnings</h4>
                            <ul>
                                {preview.stats.dirtyRooms > 0 && (
                                    <li>There are {preview.stats.dirtyRooms} rooms still marked as dirty. Ensure housekeeping is finished before running audit.</li>
                                )}
                            </ul>
                        </div>
                    )}

                    <div className="audit-action-section">
                        <h3>Ready to Close the Day?</h3>
                        <p>Running the Night Audit will finalize {formatDate(preview.auditDate)}.</p>

                        <textarea
                            className="audit-notes-input"
                            placeholder="Optional notes for tonight's audit..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                        <br />
                        <button
                            className="btn-run-audit"
                            onClick={handleRunAudit}
                            disabled={isRunning}
                        >
                            {isRunning ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    Processing Night Audit...
                                </>
                            ) : (
                                <>🌙 Run Night Audit</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── HISTORY TABLE ─── */}
            <div className="audit-history-section mt-5">
                <h2>Audit History</h2>
                {history.length > 0 ? (
                    <div className="table-responsive">
                        <table className="audit-history-table">
                            <thead>
                                <tr>
                                    <th>Audit Date</th>
                                    <th>Run At</th>
                                    <th>Run By</th>
                                    <th>Occupancy</th>
                                    <th>ADR</th>
                                    <th>Total Revenue</th>
                                    <th>No Shows</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(audit => (
                                    <tr key={audit.id}>
                                        <td><strong>{formatDate(audit.audit_date)}</strong></td>
                                        <td className="text-muted">{new Date(audit.run_at).toLocaleString()}</td>
                                        <td>{audit.run_by_name || 'System'}</td>
                                        <td>{audit.occupancy_pct}% ({audit.occupied_rooms}/{audit.total_rooms})</td>
                                        <td>{formatCurrency(audit.adr)}</td>
                                        <td className="text-success">{formatCurrency(audit.total_revenue)}</td>
                                        <td className={audit.no_shows > 0 ? 'text-warning' : ''}>
                                            {audit.no_shows}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No past audits found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NightAudit;
