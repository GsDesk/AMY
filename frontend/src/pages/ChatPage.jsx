import { useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import LiveExamplePanel from '../components/LiveExamplePanel';
import './ChatPage.css';

export default function ChatPage() {
    const [activeExample, setActiveExample] = useState(null);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [conversationKey, setConversationKey] = useState(0);

    const handleSelectConversation = useCallback((id) => {
        setCurrentConversationId(id);
        setActiveExample(null);
    }, []);

    const handleNewConversation = useCallback(() => {
        setCurrentConversationId(null);
        setActiveExample(null);
        setConversationKey(prev => prev + 1);
    }, []);

    return (
        <div className={`chat-page ${activeExample ? 'with-panel' : ''}`}>
            <Sidebar
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
                activeConversationId={currentConversationId}
            />
            <ChatWindow
                key={conversationKey}
                conversationId={currentConversationId}
                onExampleReceived={setActiveExample}
                onConversationCreated={setCurrentConversationId}
            />
            {activeExample && (
                <LiveExamplePanel
                    example={activeExample}
                    onClose={() => setActiveExample(null)}
                />
            )}
        </div>
    );
}
