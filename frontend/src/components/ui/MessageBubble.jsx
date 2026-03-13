/**
 * 对话气泡
 */
export function MessageBubble({ role, content, time, index }) {
  const isUser = role === 'user';
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.2)}s`, animationFillMode: 'both' }}
    >
      <div
        className={`
          max-w-[85%] rounded-2xl px-4 py-2.5
          transition-all duration-300 hover:shadow-sm
          ${isUser
            ? 'bg-blue-500 text-white rounded-br-md shadow-sm'
            : 'bg-transparent text-gray-800 rounded-bl-md'
          }
        `}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        <span className="text-xs opacity-70 mt-1 block">{time}</span>
      </div>
    </div>
  );
}
