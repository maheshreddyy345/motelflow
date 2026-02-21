import { useState, useEffect } from 'react';
import { reportsApi, formatCurrency, getRoomTypeLabel } from '../utils/api';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import './Reports.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const Reports = () => {
    const [activeTab, setActiveTab] = useState('revenue');
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('month');

    // Date range
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Data states
    const [summary, setSummary] = useState(null);
    const [revenueData, setRevenueData] = useState(null);
    const [occupancyData, setOccupancyData] = useState(null);
    const [ratesData, setRatesData] = useState(null);
    const [paymentsData, setPaymentsData] = useState(null);

    // Initialize date range
    useEffect(() => {
        applyDatePreset('month');
    }, []);

    // Load data when dates change
    useEffect(() => {
        if (startDate && endDate) {
            loadAllData();
        }
    }, [startDate, endDate]);

    const applyDatePreset = (preset) => {
        const today = new Date();
        let start, end;

        switch (preset) {
            case 'today':
                start = end = today;
                break;
            case 'week':
                start = new Date(today);
                start.setDate(today.getDate() - today.getDay());
                end = today;
                break;
            case 'month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = today;
                break;
            case 'last30':
                start = new Date(today);
                start.setDate(today.getDate() - 30);
                end = today;
                break;
            case 'last90':
                start = new Date(today);
                start.setDate(today.getDate() - 90);
                end = today;
                break;
            default:
                return;
        }

        setDateRange(preset);
        setStartDate(formatISO(start));
        setEndDate(formatISO(end));
    };

    const formatISO = (date) => {
        return date.toISOString().split('T')[0];
    };

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [summaryRes, revenueRes, occupancyRes, ratesRes, paymentsRes] = await Promise.all([
                reportsApi.getSummary(startDate, endDate),
                reportsApi.getRevenue(startDate, endDate),
                reportsApi.getOccupancy(startDate, endDate),
                reportsApi.getRates(startDate, endDate),
                reportsApi.getPayments(startDate, endDate),
            ]);
            setSummary(summaryRes);
            setRevenueData(revenueRes);
            setOccupancyData(occupancyRes);
            setRatesData(ratesRes);
            setPaymentsData(paymentsRes);
        } catch (err) {
            console.error('Failed to load reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatShortDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Chart color palettes
    const colors = {
        green: 'rgba(16, 185, 129, 1)',
        greenBg: 'rgba(16, 185, 129, 0.15)',
        blue: 'rgba(59, 130, 246, 1)',
        blueBg: 'rgba(59, 130, 246, 0.15)',
        amber: 'rgba(245, 158, 11, 1)',
        amberBg: 'rgba(245, 158, 11, 0.15)',
        purple: 'rgba(139, 92, 246, 1)',
        purpleBg: 'rgba(139, 92, 246, 0.15)',
        red: 'rgba(239, 68, 68, 1)',
        redBg: 'rgba(239, 68, 68, 0.15)',
        cyan: 'rgba(6, 182, 212, 1)',
        cyanBg: 'rgba(6, 182, 212, 0.15)',
    };

    const chartPalette = [
        'rgba(16, 185, 129, 0.85)',
        'rgba(59, 130, 246, 0.85)',
        'rgba(245, 158, 11, 0.85)',
        'rgba(139, 92, 246, 0.85)',
        'rgba(239, 68, 68, 0.85)',
        'rgba(6, 182, 212, 0.85)',
        'rgba(236, 72, 153, 0.85)',
        'rgba(34, 197, 94, 0.85)',
    ];

    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#94a3b8', font: { size: 12 } }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f1f5f9',
                bodyColor: '#cbd5e1',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
            }
        },
        scales: {
            x: {
                ticks: { color: '#64748b', font: { size: 11 } },
                grid: { color: 'rgba(51, 65, 85, 0.3)' }
            },
            y: {
                ticks: { color: '#64748b', font: { size: 11 } },
                grid: { color: 'rgba(51, 65, 85, 0.3)' }
            }
        }
    };

    // Chart configurations
    const getRevenueBarChart = () => {
        if (!revenueData?.dailyRevenue) return null;
        return {
            labels: revenueData.dailyRevenue.map(d => formatShortDate(d.date)),
            datasets: [{
                label: 'Daily Revenue',
                data: revenueData.dailyRevenue.map(d => parseFloat(d.revenue)),
                backgroundColor: colors.greenBg,
                borderColor: colors.green,
                borderWidth: 2,
                borderRadius: 6,
                hoverBackgroundColor: 'rgba(16, 185, 129, 0.4)',
            }]
        };
    };

    const getChargeBreakdownChart = () => {
        if (!revenueData?.chargeBreakdown?.length) return null;
        const categoryLabels = {
            room: 'Room Charges',
            deposit: 'Deposits',
            extra: 'Extra Fees',
            purchase: 'Purchases',
            damage: 'Damage',
            fee: 'Fees',
        };
        return {
            labels: revenueData.chargeBreakdown.map(d => categoryLabels[d.category] || d.category),
            datasets: [{
                data: revenueData.chargeBreakdown.map(d => parseFloat(d.total)),
                backgroundColor: chartPalette.slice(0, revenueData.chargeBreakdown.length),
                borderWidth: 0,
                hoverOffset: 8,
            }]
        };
    };

    const getOccupancyLineChart = () => {
        if (!occupancyData?.dailyOccupancy) return null;
        const totalRooms = occupancyData.totalRooms || 1;
        return {
            labels: occupancyData.dailyOccupancy.map(d => formatShortDate(d.date)),
            datasets: [{
                label: 'Occupancy %',
                data: occupancyData.dailyOccupancy.map(d =>
                    parseFloat(((d.occupied / totalRooms) * 100).toFixed(1))
                ),
                borderColor: colors.blue,
                backgroundColor: colors.blueBg,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 6,
                borderWidth: 2.5,
            }]
        };
    };

    const getFloorOccupancyChart = () => {
        if (!occupancyData?.floorOccupancy?.length) return null;
        return {
            labels: occupancyData.floorOccupancy.map(d => `Floor ${d.floor}`),
            datasets: [{
                label: 'Occupied Rooms',
                data: occupancyData.floorOccupancy.map(d => parseInt(d.occupied)),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: colors.blue,
                borderWidth: 2,
                borderRadius: 6,
            }, {
                label: 'Total Rooms',
                data: occupancyData.floorOccupancy.map(d => parseInt(d.total_rooms)),
                backgroundColor: 'rgba(51, 65, 85, 0.4)',
                borderColor: 'rgba(100, 116, 139, 0.6)',
                borderWidth: 1,
                borderRadius: 6,
            }]
        };
    };

    const getRoomTypeChart = () => {
        if (!ratesData?.byRoomType?.length) return null;
        return {
            labels: ratesData.byRoomType.map(d => getRoomTypeLabel(d.room_type)),
            datasets: [{
                label: 'Revenue',
                data: ratesData.byRoomType.map(d => parseFloat(d.revenue)),
                backgroundColor: chartPalette.slice(0, ratesData.byRoomType.length),
                borderWidth: 0,
                borderRadius: 6,
            }]
        };
    };

    const getRateCategoryChart = () => {
        if (!ratesData?.byRateCategory?.length) return null;
        const categoryLabels = {
            regular: 'Regular',
            aaa: 'AAA',
            military: 'Military',
            government: 'Government',
            senior: 'Senior',
            weekly: 'Weekly',
        };
        return {
            labels: ratesData.byRateCategory.map(d => categoryLabels[d.rate_category] || d.rate_category),
            datasets: [{
                data: ratesData.byRateCategory.map(d => parseInt(d.bookings)),
                backgroundColor: chartPalette.slice(0, ratesData.byRateCategory.length),
                borderWidth: 0,
                hoverOffset: 8,
            }]
        };
    };

    const getPaymentMethodChart = () => {
        if (!paymentsData?.methodDistribution?.length) return null;
        const methodLabels = { cash: '💵 Cash', card: '💳 Card', check: '📄 Check', refund: '↩️ Refund' };
        return {
            labels: paymentsData.methodDistribution.map(d => methodLabels[d.method] || d.method),
            datasets: [{
                data: paymentsData.methodDistribution.map(d => parseFloat(d.total)),
                backgroundColor: [
                    'rgba(16, 185, 129, 0.85)',
                    'rgba(59, 130, 246, 0.85)',
                    'rgba(245, 158, 11, 0.85)',
                    'rgba(239, 68, 68, 0.85)',
                ],
                borderWidth: 0,
                hoverOffset: 8,
            }]
        };
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#94a3b8', font: { size: 12 }, padding: 16 }
            },
            tooltip: chartDefaults.plugins.tooltip
        }
    };

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#94a3b8', font: { size: 12 }, padding: 16 }
            },
            tooltip: chartDefaults.plugins.tooltip
        }
    };

    const tabs = [
        { id: 'revenue', label: '💰 Revenue', icon: '💰' },
        { id: 'occupancy', label: '🏨 Occupancy', icon: '🏨' },
        { id: 'rates', label: '💵 Rate Analysis', icon: '💵' },
        { id: 'payments', label: '💳 Payments', icon: '💳' },
    ];

    if (loading && !summary) {
        return <div className="loading"><div className="spinner"></div></div>;
    }

    return (
        <div className="reports-page">
            {/* Header */}
            <div className="reports-header">
                <div className="reports-title-section">
                    <h1>📊 Reports & Analytics</h1>
                    <p className="subtitle">Performance insights for your property</p>
                </div>
                <div className="date-range-controls">
                    <div className="date-presets">
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'week', label: 'This Week' },
                            { id: 'month', label: 'This Month' },
                            { id: 'last30', label: 'Last 30 Days' },
                            { id: 'last90', label: 'Last 90 Days' },
                        ].map(preset => (
                            <button
                                key={preset.id}
                                className={`preset-btn ${dateRange === preset.id ? 'active' : ''}`}
                                onClick={() => applyDatePreset(preset.id)}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <div className="date-inputs">
                        <input
                            type="date"
                            className="form-input"
                            value={startDate}
                            onChange={e => { setStartDate(e.target.value); setDateRange('custom'); }}
                        />
                        <span className="date-separator">→</span>
                        <input
                            type="date"
                            className="form-input"
                            value={endDate}
                            onChange={e => { setEndDate(e.target.value); setDateRange('custom'); }}
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            {summary && (
                <div className="kpi-grid">
                    <div className="kpi-card kpi-green">
                        <div className="kpi-icon">💰</div>
                        <div className="kpi-content">
                            <span className="kpi-value">{formatCurrency(summary.totalRevenue)}</span>
                            <span className="kpi-label">Total Revenue</span>
                        </div>
                    </div>
                    <div className="kpi-card kpi-blue">
                        <div className="kpi-icon">📊</div>
                        <div className="kpi-content">
                            <span className="kpi-value">{summary.avgOccupancy}%</span>
                            <span className="kpi-label">Avg Occupancy</span>
                        </div>
                    </div>
                    <div className="kpi-card kpi-amber">
                        <div className="kpi-icon">💵</div>
                        <div className="kpi-content">
                            <span className="kpi-value">{formatCurrency(summary.adr)}</span>
                            <span className="kpi-label">ADR</span>
                        </div>
                    </div>
                    <div className="kpi-card kpi-purple">
                        <div className="kpi-icon">🏨</div>
                        <div className="kpi-content">
                            <span className="kpi-value">{formatCurrency(summary.revpar)}</span>
                            <span className="kpi-label">RevPAR</span>
                        </div>
                    </div>
                    <div className="kpi-card kpi-cyan">
                        <div className="kpi-icon">📅</div>
                        <div className="kpi-content">
                            <span className="kpi-value">{summary.totalBookings}</span>
                            <span className="kpi-label">Total Bookings</span>
                        </div>
                    </div>
                    <div className="kpi-card kpi-red">
                        <div className="kpi-icon">❌</div>
                        <div className="kpi-content">
                            <span className="kpi-value">{summary.cancellationRate}%</span>
                            <span className="kpi-label">Cancellation Rate</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="reports-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`report-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="reports-content">
                {loading && (
                    <div className="reports-loading-overlay">
                        <div className="spinner"></div>
                    </div>
                )}

                {/* Revenue Tab */}
                {activeTab === 'revenue' && revenueData && (
                    <div className="charts-grid">
                        <div className="chart-card chart-wide">
                            <h3>Daily Revenue</h3>
                            <div className="chart-container chart-tall">
                                {getRevenueBarChart() && (
                                    <Bar data={getRevenueBarChart()} options={{
                                        ...chartDefaults,
                                        plugins: {
                                            ...chartDefaults.plugins,
                                            legend: { display: false },
                                            tooltip: {
                                                ...chartDefaults.plugins.tooltip,
                                                callbacks: {
                                                    label: (ctx) => `Revenue: $${ctx.parsed.y.toFixed(2)}`
                                                }
                                            }
                                        },
                                        scales: {
                                            ...chartDefaults.scales,
                                            y: {
                                                ...chartDefaults.scales.y,
                                                ticks: {
                                                    ...chartDefaults.scales.y.ticks,
                                                    callback: (val) => `$${val}`
                                                }
                                            }
                                        }
                                    }} />
                                )}
                            </div>
                        </div>
                        <div className="chart-card">
                            <h3>Charges by Category</h3>
                            <div className="chart-container">
                                {getChargeBreakdownChart() ? (
                                    <Doughnut data={getChargeBreakdownChart()} options={{
                                        ...doughnutOptions,
                                        plugins: {
                                            ...doughnutOptions.plugins,
                                            tooltip: {
                                                ...doughnutOptions.plugins.tooltip,
                                                callbacks: {
                                                    label: (ctx) => `${ctx.label}: $${ctx.parsed.toFixed(2)}`
                                                }
                                            }
                                        }
                                    }} />
                                ) : (
                                    <div className="no-data">No charge data for this period</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Occupancy Tab */}
                {activeTab === 'occupancy' && occupancyData && (
                    <div className="charts-grid">
                        <div className="chart-card chart-wide">
                            <h3>Daily Occupancy Trend</h3>
                            <div className="chart-container chart-tall">
                                {getOccupancyLineChart() && (
                                    <Line data={getOccupancyLineChart()} options={{
                                        ...chartDefaults,
                                        plugins: {
                                            ...chartDefaults.plugins,
                                            legend: { display: false },
                                            tooltip: {
                                                ...chartDefaults.plugins.tooltip,
                                                callbacks: {
                                                    label: (ctx) => `Occupancy: ${ctx.parsed.y}%`
                                                }
                                            }
                                        },
                                        scales: {
                                            ...chartDefaults.scales,
                                            y: {
                                                ...chartDefaults.scales.y,
                                                min: 0,
                                                max: 100,
                                                ticks: {
                                                    ...chartDefaults.scales.y.ticks,
                                                    callback: (val) => `${val}%`
                                                }
                                            }
                                        }
                                    }} />
                                )}
                            </div>
                        </div>
                        <div className="chart-card">
                            <h3>Occupancy by Floor</h3>
                            <div className="chart-container">
                                {getFloorOccupancyChart() ? (
                                    <Bar data={getFloorOccupancyChart()} options={{
                                        ...chartDefaults,
                                        indexAxis: 'y',
                                        plugins: {
                                            ...chartDefaults.plugins,
                                            legend: {
                                                labels: { color: '#94a3b8', font: { size: 11 } }
                                            }
                                        }
                                    }} />
                                ) : (
                                    <div className="no-data">No floor data available</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Rate Analysis Tab */}
                {activeTab === 'rates' && ratesData && (
                    <div className="charts-grid">
                        <div className="chart-card chart-wide">
                            <h3>Revenue by Room Type</h3>
                            <div className="chart-container chart-tall">
                                {getRoomTypeChart() ? (
                                    <Bar data={getRoomTypeChart()} options={{
                                        ...chartDefaults,
                                        plugins: {
                                            ...chartDefaults.plugins,
                                            legend: { display: false },
                                            tooltip: {
                                                ...chartDefaults.plugins.tooltip,
                                                callbacks: {
                                                    label: (ctx) => `Revenue: $${ctx.parsed.y.toFixed(2)}`
                                                }
                                            }
                                        },
                                        scales: {
                                            ...chartDefaults.scales,
                                            y: {
                                                ...chartDefaults.scales.y,
                                                ticks: {
                                                    ...chartDefaults.scales.y.ticks,
                                                    callback: (val) => `$${val}`
                                                }
                                            }
                                        }
                                    }} />
                                ) : (
                                    <div className="no-data">No room type data for this period</div>
                                )}
                            </div>
                        </div>
                        <div className="chart-card">
                            <h3>Bookings by Rate Category</h3>
                            <div className="chart-container">
                                {getRateCategoryChart() ? (
                                    <Pie data={getRateCategoryChart()} options={pieOptions} />
                                ) : (
                                    <div className="no-data">No rate category data for this period</div>
                                )}
                            </div>
                        </div>
                        {/* Rate stats table */}
                        {ratesData.byRoomType?.length > 0 && (
                            <div className="chart-card chart-full">
                                <h3>Room Type Performance</h3>
                                <table className="reports-table">
                                    <thead>
                                        <tr>
                                            <th>Room Type</th>
                                            <th>Bookings</th>
                                            <th>Avg Rate</th>
                                            <th>Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ratesData.byRoomType.map(rt => (
                                            <tr key={rt.room_type}>
                                                <td><strong>{getRoomTypeLabel(rt.room_type)}</strong></td>
                                                <td>{rt.bookings}</td>
                                                <td>{formatCurrency(rt.avg_rate)}</td>
                                                <td className="revenue-cell">{formatCurrency(rt.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Payments Tab */}
                {activeTab === 'payments' && paymentsData && (
                    <div className="charts-grid">
                        <div className="chart-card">
                            <h3>Payment Method Distribution</h3>
                            <div className="chart-container">
                                {getPaymentMethodChart() ? (
                                    <Doughnut data={getPaymentMethodChart()} options={{
                                        ...doughnutOptions,
                                        plugins: {
                                            ...doughnutOptions.plugins,
                                            tooltip: {
                                                ...doughnutOptions.plugins.tooltip,
                                                callbacks: {
                                                    label: (ctx) => `${ctx.label}: $${ctx.parsed.toFixed(2)}`
                                                }
                                            }
                                        }
                                    }} />
                                ) : (
                                    <div className="no-data">No payment data for this period</div>
                                )}
                            </div>
                        </div>
                        <div className="chart-card chart-wide">
                            <h3>Recent Payments</h3>
                            {paymentsData.recentPayments?.length > 0 ? (
                                <div className="payments-table-wrapper">
                                    <table className="reports-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Guest</th>
                                                <th>Confirmation</th>
                                                <th>Method</th>
                                                <th>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paymentsData.recentPayments.map(p => (
                                                <tr key={p.id}>
                                                    <td>{new Date(p.date_received).toLocaleDateString()}</td>
                                                    <td>{p.first_name} {p.last_name}</td>
                                                    <td><code>{p.confirmation_number}</code></td>
                                                    <td>
                                                        <span className={`method-badge method-${p.method}`}>
                                                            {p.method === 'cash' ? '💵' : p.method === 'card' ? '💳' : '📄'} {p.method}
                                                        </span>
                                                    </td>
                                                    <td className="revenue-cell">{formatCurrency(p.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="no-data">No payments recorded for this period</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
