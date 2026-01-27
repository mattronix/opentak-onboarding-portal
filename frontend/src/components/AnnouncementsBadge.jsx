import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { announcementsAPI } from '../services/api';
import './AnnouncementsBadge.css';

function AnnouncementsBadge() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showPanel, setShowPanel] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const { data: countData } = useQuery({
    queryKey: ['announcementsUnread'],
    queryFn: async () => {
      const response = await announcementsAPI.getUnreadCount();
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: announcementsData } = useQuery({
    queryKey: ['userAnnouncements'],
    queryFn: async () => {
      const response = await announcementsAPI.getAll();
      return response.data;
    },
    enabled: showPanel,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => announcementsAPI.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcementsUnread']);
      queryClient.invalidateQueries(['userAnnouncements']);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id) => announcementsAPI.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcementsUnread']);
      queryClient.invalidateQueries(['userAnnouncements']);
      setSelectedAnnouncement(null);
    },
  });

  const handleAnnouncementClick = (announcement) => {
    setSelectedAnnouncement(announcement);
    if (!announcement.isRead) {
      markReadMutation.mutate(announcement.id);
    }
  };

  const handleDismiss = (e, announcementId) => {
    e.stopPropagation();
    dismissMutation.mutate(announcementId);
  };

  const unreadCount = countData?.unreadCount || 0;
  const announcements = announcementsData?.announcements || [];

  return (
    <div className="announcements-badge-container">
      <button
        className="announcements-badge-btn"
        onClick={() => setShowPanel(!showPanel)}
        title="Announcements"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="badge-count">{unreadCount}</span>
        )}
      </button>

      {showPanel && (
        <>
          <div className="announcements-backdrop" onClick={() => setShowPanel(false)} />
          <div className="announcements-panel">
            <div className="panel-header">
              <h3>Announcements</h3>
              <button onClick={() => setShowPanel(false)}>x</button>
            </div>
            <div className="panel-body">
              {announcements.length === 0 ? (
                <p className="no-announcements">No announcements</p>
              ) : (
                <ul className="announcements-list">
                  {announcements.map(a => (
                    <li
                      key={a.id}
                      className={`announcement-item ${!a.isRead ? 'unread' : ''}`}
                      onClick={() => handleAnnouncementClick(a)}
                    >
                      <div className="announcement-content">
                        <strong>{a.title}</strong>
                        <span className="date">{new Date(a.sentAt).toLocaleDateString()}</span>
                      </div>
                      <button
                        className="dismiss-btn"
                        onClick={(e) => handleDismiss(e, a.id)}
                        title="Dismiss"
                      >
                        x
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="panel-footer">
              <button
                className="view-history-btn"
                onClick={() => {
                  setShowPanel(false);
                  navigate('/announcements');
                }}
              >
                View All History
              </button>
            </div>
          </div>
        </>
      )}

      {selectedAnnouncement && (
        <div className="announcement-modal-overlay" onClick={() => setSelectedAnnouncement(null)}>
          <div className="announcement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedAnnouncement.title}</h2>
              <button onClick={() => setSelectedAnnouncement(null)}>x</button>
            </div>
            <div className="modal-body">
              <div dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }} />
            </div>
            <div className="modal-footer">
              <span className="date">Posted: {new Date(selectedAnnouncement.sentAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnouncementsBadge;
