import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { announcementsAPI } from '../services/api';
import './AnnouncementHistory.css';

function AnnouncementHistory() {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['announcementHistory'],
    queryFn: async () => {
      const response = await announcementsAPI.getHistory();
      return response.data;
    },
  });

  const announcements = data?.announcements || [];

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Convert HTML to plain text (strips tags and decodes entities)
  const htmlToPlainText = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  return (
    <div className="announcement-history-page">
      <div className="page-header">
        <h1>Announcement History</h1>
        <p>View all announcements that were sent to you</p>
      </div>

      {isLoading ? (
        <div className="loading">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="empty-state">
          <p>No announcements have been sent to you yet.</p>
        </div>
      ) : (
        <div className="announcements-list">
          {announcements.map(announcement => (
            <div
              key={announcement.id}
              className={`announcement-card ${!announcement.isRead ? 'unread' : ''} ${announcement.isDismissed ? 'dismissed' : ''}`}
              onClick={() => setSelectedAnnouncement(announcement)}
            >
              <div className="announcement-header">
                <h3>{announcement.title}</h3>
                <div className="announcement-badges">
                  {!announcement.isRead && (
                    <span className="badge badge-unread">Unread</span>
                  )}
                  {announcement.isDismissed && (
                    <span className="badge badge-dismissed">Dismissed</span>
                  )}
                </div>
              </div>
              <div className="announcement-meta">
                <span className="date">{formatDate(announcement.sentAt)}</span>
              </div>
              <div className="announcement-preview">
                {htmlToPlainText(announcement.content).substring(0, 150)}
                {htmlToPlainText(announcement.content).length > 150 ? '...' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAnnouncement && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedAnnouncement.title}</h2>
              <button className="close-btn" onClick={() => setSelectedAnnouncement(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }} />
            </div>
            <div className="modal-footer">
              <span className="date">Posted: {formatDate(selectedAnnouncement.sentAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnouncementHistory;
