import { useNotification } from '../contexts/NotificationContext';
import './Notifications.css';

const Notifications = () => {
  const { notifications, removeNotification, confirmDialog } = useNotification();

  return (
    <>
      {/* Toast Notifications */}
      <div className="notifications-container">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification notification-${notification.type}`}
          >
            <div className="notification-content">
              <span className="notification-icon">
                {notification.type === 'success' && '✓'}
                {notification.type === 'error' && '✕'}
                {notification.type === 'warning' && '⚠'}
                {notification.type === 'info' && 'ℹ'}
              </span>
              <span className="notification-message">{notification.message}</span>
            </div>
            <button
              className="notification-close"
              onClick={() => removeNotification(notification.id)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <div className="confirm-header">
              <h3>{confirmDialog.title}</h3>
            </div>
            <div className="confirm-body">
              <p>{confirmDialog.message}</p>
            </div>
            <div className="confirm-actions">
              <button
                className="btn-confirm-cancel"
                onClick={confirmDialog.onCancel}
              >
                Cancel
              </button>
              <button
                className="btn-confirm-ok"
                onClick={confirmDialog.onConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Notifications;
