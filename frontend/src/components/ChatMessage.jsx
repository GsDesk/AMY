import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ChatMessage.css';

export default function ChatMessage({ message }) {
    const isTutor = message.sender === 'tutor';
    const isError = message.source === 'error';

    return (
        <div className={`chat-message ${isTutor ? 'tutor-msg' : 'user-msg'} ${isError ? 'error-msg' : ''}`}>
            {isTutor && (
                <div className="msg-avatar tutor-avatar">
                    <span>A</span>
                </div>
            )}

            <div className="msg-content">
                <div className="msg-bubble">
                    {isTutor ? (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            style={oneDark}
                                            language={match[1]}
                                            PreTag="div"
                                            customStyle={{
                                                borderRadius: '6px',
                                                fontSize: '0.82rem',
                                                margin: '0.6rem 0',
                                                background: '#111111'
                                            }}
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className="inline-code" {...props}>
                                            {children}
                                        </code>
                                    );
                                }
                            }}
                        >
                            {message.text}
                        </ReactMarkdown>
                    ) : (
                        <p>{message.text}</p>
                    )}
                </div>

                {isTutor && message.source && message.source !== 'system' && (
                    <div className="msg-meta">
                        <span className={`source-badge ${isError ? 'badge-error' : 'badge-default'}`}>
                            {isError ? 'Error' : 'Mistral'}
                        </span>
                        {message.topic && message.topic !== 'Error' && (
                            <span className="topic-badge">{message.topic}</span>
                        )}
                        {message.ragUsed && (
                            <span className="rag-badge">RAG</span>
                        )}
                        {message.hasExample && (
                            <span className="example-badge">Panel Abierto</span>
                        )}
                    </div>
                )}
            </div>

            {!isTutor && (
                <div className="msg-avatar user-avatar">
                    <span>E</span>
                </div>
            )}
        </div>
    );
}
