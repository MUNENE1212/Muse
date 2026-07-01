import { signal } from "@preact/signals";

export interface Notification {
  id: string;
  type: "circle_join" | "follow" | "collaboration" | "mention" | "achievement";
  title: string;
  message: string;
  avatar?: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
};

export const notificationSignal = signal<NotificationState>(initialState);

export const addNotification = (
  type: Notification["type"],
  title: string,
  message: string,
  options?: {
    avatar?: string;
    actionUrl?: string;
  },
) => {
  const notification: Notification = {
    id: `notif-${Date.now()}`,
    type,
    title,
    message,
    avatar: options?.avatar,
    timestamp: Date.now(),
    read: false,
    actionUrl: options?.actionUrl,
  };

  notificationSignal.value = {
    notifications: [notification, ...notificationSignal.value.notifications],
    unreadCount: notificationSignal.value.unreadCount + 1,
  };

  // Auto-remove after 6 seconds
  setTimeout(() => {
    removeNotification(notification.id);
  }, 6000);
};

export const removeNotification = (id: string) => {
  const currentNotif = notificationSignal.value.notifications.find((n) =>
    n.id === id
  );
  const wasUnread = currentNotif && !currentNotif.read;

  notificationSignal.value = {
    notifications: notificationSignal.value.notifications.filter(
      (n) => n.id !== id,
    ),
    unreadCount: wasUnread
      ? Math.max(0, notificationSignal.value.unreadCount - 1)
      : notificationSignal.value.unreadCount,
  };
};

export const markAsRead = (id: string) => {
  notificationSignal.value = {
    ...notificationSignal.value,
    notifications: notificationSignal.value.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
    unreadCount: Math.max(
      0,
      notificationSignal.value.unreadCount -
        (notificationSignal.value.notifications.find((n) => n.id === id)?.read
          ? 0
          : 1),
    ),
  };
};

export const markAllAsRead = () => {
  notificationSignal.value = {
    ...notificationSignal.value,
    notifications: notificationSignal.value.notifications.map((n) => ({
      ...n,
      read: true,
    })),
    unreadCount: 0,
  };
};

export const clearAll = () => {
  notificationSignal.value = initialState;
};
