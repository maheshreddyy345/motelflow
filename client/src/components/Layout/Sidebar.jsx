import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
    const { user, logout, hasRole } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        {
            path: '/',
            icon: '📊',
            label: 'Dashboard',
            roles: ['owner', 'manager', 'frontdesk']
        },
        {
            path: '/reservations',
            icon: '📅',
            label: 'Reservations',
            roles: ['owner', 'manager', 'frontdesk']
        },
        {
            path: '/rooms',
            icon: '🚪',
            label: 'Rooms',
            roles: ['owner', 'manager', 'frontdesk']
        },
        {
            path: '/housekeeping',
            icon: '🧹',
            label: 'Housekeeping',
            roles: ['owner', 'manager', 'frontdesk', 'housekeeping']
        },
        {
            path: '/tape-chart',
            icon: '📈',
            label: 'Tape Chart',
            roles: ['owner', 'manager', 'frontdesk']
        },
        {
            path: '/reports',
            icon: '📊',
            label: 'Reports',
            roles: ['owner', 'manager']
        },
        {
            path: '/night-audit',
            icon: '🌙',
            label: 'Night Audit',
            roles: ['owner', 'manager']
        },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <span className="logo-icon">🏨</span>
                    <span className="logo-text">Motel Flow</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems
                    .filter(item => item.roles.some(role => hasRole(role)))
                    .map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-item ${isActive ? 'active' : ''}`
                            }
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </NavLink>
                    ))
                }
            </nav>

            <div className="sidebar-footer">
                <div className="user-info">
                    <div className="user-avatar">
                        {user?.fullName?.charAt(0) || 'U'}
                    </div>
                    <div className="user-details">
                        <div className="user-name">{user?.fullName}</div>
                        <div className="user-role">{user?.role}</div>
                    </div>
                </div>
                <button className="logout-btn" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
