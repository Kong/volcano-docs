import { useCallback, useState } from 'react';

export type MessageType = 'success' | 'error' | 'info';

// The message a page shows in an alert, and the alert's style
export function useStatusMessage() {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('success');

  const showMessage = useCallback((text: string, type: MessageType) => {
    setMessage(text);
    setMessageType(type);
  }, []);

  return { message, messageType, setMessage, setMessageType, showMessage };
}
