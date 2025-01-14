'use client';

import { useState, useEffect, useRef } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export default function Home() {
  const isMobile = useIsMobile();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSpaceHint, setShowSpaceHint] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const currentChat = chats.find(chat => chat.id === currentChatId);

  useEffect(() => {
    const savedChats = localStorage.getItem('chats');
    const savedCurrentChat = localStorage.getItem('currentChatId');
    if (savedChats) {
      setChats(JSON.parse(savedChats));
    }
    if (savedCurrentChat) {
      setCurrentChatId(savedCurrentChat);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem('currentChatId', currentChatId);
    }
  }, [currentChatId]);

  useEffect(() => {
    const scrollToBottom = () => {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    // Scroll on new messages or loading state change
    scrollToBottom();

    // Also scroll after a short delay to handle dynamic content
    const timeoutId = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timeoutId);
  }, [currentChat?.messages, loading]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ' && 
          !loading && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [loading]);

  useEffect(() => {
    if (isMobile) return; // Don't show hint on mobile
    
    const showHint = () => {
      setShowSpaceHint(true);
      setTimeout(() => setShowSpaceHint(false), 7000);
    };

    showHint();
    const handleNewChat = () => showHint();
    window.addEventListener('newChat', handleNewChat);

    return () => window.removeEventListener('newChat', handleNewChat);
  }, [isMobile]);

  useEffect(() => {
    if (chats.length === 0) {
      startNewChat();
    }
  }, [chats.length]);

  const startNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: []
    };
    setChats(prev => [...prev, newChat]);
    setCurrentChatId(newChat.id);
    setPrompt('');
    setIsHistoryOpen(false);
    window.dispatchEvent(new Event('newChat'));
  };

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(prev => {
      const updatedChats = prev.filter(chat => chat.id !== chatId);
      // If we're deleting the last chat, let the useEffect handle creating a new one
      if (updatedChats.length === 0) {
        setCurrentChatId(null);
      }
      return updatedChats;
    });
    if (currentChatId === chatId) {
      setCurrentChatId(null);
    }
  };

  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort();
    }
    setIsGenerating(false);
    setLoading(false);
    const stopMessage: Message = {
      role: 'assistant',
      content: '🛑 Problem solving AI stopped.'
    };
    setChats(prev => prev.map(chat => 
      chat.id === currentChatId 
        ? { ...chat, messages: [...chat.messages, stopMessage] }
        : chat
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading || !currentChatId) return;
    
    const controller = new AbortController();
    setAbortController(controller);
    setIsGenerating(true);

    const userMessage: Message = { role: 'user', content: prompt.trim() };
    setPrompt('');
    setLoading(true);

    // Update current chat with user message
    setChats(prev => prev.map(chat => 
      chat.id === currentChatId 
        ? { ...chat, messages: [...chat.messages, userMessage] }
        : chat
    ));

    try {
      const currentChat = chats.find(chat => chat.id === currentChatId);
      const conversationContext = currentChat?.messages
        .map(msg => msg.role === 'user' ? `user: ${msg.content}` : msg.content)
        .join('\n\n');
      
      const fullPrompt = conversationContext 
        ? `${conversationContext}\n\nuser: ${userMessage.content}`
        : userMessage.content;

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt }),
        signal: controller.signal
      });

      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      if (!data.response) throw new Error('No response received');

      const assistantMessage: Message = { role: 'assistant', content: data.response };
      
      setChats(prev => prev.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: [...chat.messages, assistantMessage] }
          : chat
      ));
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return;
      
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Failed to get response'
      };
      setChats(prev => prev.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: [...chat.messages, errorMessage] }
          : chat
      ));
    } finally {
      setAbortController(null);
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const formatResponseText = (text: string) => {
    return text.split('\n').map((line, index) => (
      <p key={index} className="text-gray-300 mb-4 last:mb-0">
        {line}
      </p>
    ));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#343541] flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-800/30 to-transparent" />
      
      <div 
        className={`fixed top-0 left-0 h-full transition-all duration-300 z-30
          ${isHistoryOpen ? 'w-full md:w-80' : 'w-0'}
        `}
      >
        {isHistoryOpen && (
          <div 
            className="fixed inset-0 bg-black/50 md:hidden"
            onClick={() => setIsHistoryOpen(false)}
          />
        )}
        
        <div 
          className={`relative h-full bg-[#202123] transition-all duration-300
            ${isHistoryOpen ? 'w-80' : 'w-0'}`}
        >
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="absolute -right-12 top-4 bg-[#202123] p-2 rounded-r-xl"
          >
            <svg className={`w-6 h-6 text-gray-300 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {isHistoryOpen && (
            <div className="p-4 h-full overflow-y-auto">
              <button
                onClick={startNewChat}
                className="w-full mb-4 flex items-center justify-center space-x-2 px-4 py-3 bg-[#2A2B32] hover:bg-[#343541] rounded-lg text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Chat</span>
              </button>

              <div className="space-y-2">
                {chats.map(chat => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setCurrentChatId(chat.id);
                      setIsHistoryOpen(false);
                    }}
                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      chat.id === currentChatId ? 'bg-[#343541]' : 'bg-[#2A2B32] hover:bg-[#343541]'
                    }`}
                  >
                    <p className="text-gray-300 text-sm truncate flex-1 mr-2">
                      {chat.messages[0]?.content.slice(0, 30) || 'New Chat'}...
                    </p>
                    <button
                      onClick={(e) => deleteChat(chat.id, e)}
                      className="text-gray-500 hover:text-gray-300 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <main className={`flex-1 flex flex-col transition-all duration-300 ${isHistoryOpen ? 'md:ml-80' : 'ml-0'}`}>
        <div className="text-center py-8 animate-fade-in px-8 md:px-0">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-gray-300 to-gray-100 mb-4">
            AI Problem Solver
          </h1>
          <p className="text-gray-400 text-lg">Intelligent solutions for complex problems</p>
        </div>

        <div className={`flex-1 overflow-y-auto px-2 sm:px-4 py-4 ${isMobile ? 'pb-32' : ''}`}>
          <div className="max-w-3xl mx-auto space-y-4">
            {!currentChat && !loading && (
              <div className="text-center text-gray-400 mt-8">
                Select a chat or start a new conversation
              </div>
            )}
            {currentChat?.messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`                  relative max-w-[85%] sm:max-w-[75%] p-3 sm:p-4 rounded-2xl break-words group
                  ${message.role === 'user' 
                    ? 'bg-[#343541] ml-4' 
                    : 'bg-[#444654] mr-4'
                  }
                `}>
                  <div className="flex items-start space-x-3">
                    {message.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-teal-600 flex-shrink-0 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white">🤖</span>
                      </div>
                    )}
                    <div className="text-gray-100 whitespace-pre-wrap break-words overflow-hidden">
                      {formatResponseText(message.content)}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => copyToClipboard(message.content)}
                    className={`
                      absolute top-2 right-2 p-1.5 
                      rounded-lg
                      bg-gray-700/30 
                      hover:bg-gray-700/50
                      text-gray-500 
                      hover:text-gray-300
                      transition-all duration-200
                      scale-90 hover:scale-100
                      ${isMobile 
                        ? 'opacity-40' 
                        : 'opacity-0 group-hover:opacity-40 hover:opacity-100'
                      }
                    `}
                    aria-label="Copy message"
                  >
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={1.5} 
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" 
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl bg-[#444654] mr-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-2 sm:px-4 mb-4">
          <div className={`
            transition-all duration-500 ease-in-out
            ${showSpaceHint ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}>
            <div className="bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-lg text-gray-400 text-sm text-center">
              Press <kbd className="px-2 py-1 bg-gray-700 rounded-md text-gray-300 text-xs">space</kbd> to type
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700/50 bg-[#343541]">
          <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
            <div className={`${isMobile ? 'fixed bottom-0 left-0 right-0 p-4 bg-[#343541] border-t border-gray-700/50' : ''}`}>
              <form ref={formRef} onSubmit={handleSubmit} className="relative mb-4 max-w-3xl mx-auto">
                <input
                  ref={inputRef}
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (prompt.trim() && !loading) {
                        formRef.current?.requestSubmit();
                      }
                    }
                  }}
                  className="w-full bg-[#40414F] text-gray-100 rounded-xl border border-gray-700 px-4 py-3 pr-24 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none"
                  placeholder="Send a message..."
                  disabled={loading || !currentChatId}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                  {isGenerating && (
                    <button
                      onClick={handleStopGeneration}
                      type="button"
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !prompt.trim() || !currentChatId}
                    className="p-2 text-gray-300 hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>
              <div className="text-center text-gray-500 text-sm">
                <p className="font-medium bg-gradient-to-r from-gray-400 via-gray-300 to-gray-400 inline-block text-transparent bg-clip-text">
                  Developed by Ibrahim
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 
