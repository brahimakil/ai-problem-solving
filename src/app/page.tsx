'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Array<{ prompt: string; response: string }>>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showFloatingCopy, setShowFloatingCopy] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(history));
  }, [history]);

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !loading) {
        formRef.current?.requestSubmit();
      }
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (responseRef.current) {
        const rect = responseRef.current.getBoundingClientRect();
        setShowFloatingCopy(rect.top < 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isHistoryOpen) {
        setIsHistoryOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isHistoryOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    
    setLoading(true);
    setResponse('');
    setCopied(false);

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.response) {
        throw new Error('No response received');
      }

      const formattedResponse = data.response
        .replace(/\*\*\s?\*\*\*\*(.*?)\*\*\*/g, '**$1**')
        .replace(/\*\*\s?\*(.*?)\*/g, '**$1**')
        .replace(/\*(.*?)\*/g, '**$1**');
      setResponse(formattedResponse);
      setHistory(prev => [...prev, { prompt, response: formattedResponse }]);
    } catch (error) {
      console.error('Error:', error);
      setResponse(error instanceof Error ? error.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const formatResponseText = (text: string) => {
    return text.split('\n').map((line, index) => {
      const headerMatch = line.match(/^\*\*(.*?)\*\*:/);
      if (headerMatch) {
        return (
          <div key={index} className="mb-6">
            <h3 className="text-xl font-bold text-gray-200 mb-2">
              {headerMatch[1]}:
            </h3>
            <p className="text-gray-300">
              {line.substring(headerMatch[0].length).trim()}
            </p>
          </div>
        );
      }
      
      if (line.includes('**')) {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={index} className="text-gray-300 mb-4 last:mb-0">
            {parts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <span key={partIndex} className="font-bold text-gray-200">
                    {part.slice(2, -2)}
                  </span>
                );
              }
              return part;
            })}
          </p>
        );
      }

      return (
        <p key={index} className="text-gray-300 mb-4 last:mb-0">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-800/30 to-transparent" />
      
      {/* Updated History Sidebar */}
      <div 
        className={`fixed top-0 left-0 h-full transition-all duration-300 z-30
          ${isHistoryOpen ? 'w-full md:w-72' : 'w-0'}
        `}
      >
        {/* Semi-transparent overlay for mobile */}
        {isHistoryOpen && (
          <div 
            className="fixed inset-0 bg-black/50 md:hidden"
            onClick={() => setIsHistoryOpen(false)}
          />
        )}
        
        <div 
          className={`relative h-full bg-gray-900/95 backdrop-blur-xl transition-all duration-300
            ${isHistoryOpen ? 'w-72' : 'w-0'}`}
        >
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="absolute -right-12 top-4 bg-gray-800/80 p-2 rounded-r-xl backdrop-blur-sm"
          >
            <svg className={`w-6 h-6 text-gray-300 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {isHistoryOpen && (
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-200">History</h3>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-sm text-gray-400 hover:text-gray-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {history.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => setPrompt(item.prompt)}
                    className="bg-gray-800/50 rounded-xl p-4 cursor-pointer hover:bg-gray-800/70 transition-all"
                  >
                    <p className="text-gray-300 text-sm truncate">{item.prompt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Copy Button */}
      {showFloatingCopy && response && !loading && (
        <button
          onClick={handleCopy}
          className="fixed top-4 right-4 z-20 bg-gray-800/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg transition-all duration-300 hover:bg-gray-700/90 flex items-center space-x-2 text-gray-300"
        >
          {copied ? (
            <span className="text-green-400">Copied!</span>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      )}

      {/* Updated Main Content */}
      <main 
        className={`relative transition-all duration-300
          ${isHistoryOpen ? 'md:ml-72' : 'ml-0'}
        `}
      >
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 via-gray-300 to-gray-100 mb-4">
              AI Problem Solver
            </h1>
            <p className="text-gray-400 text-lg">Intelligent solutions for complex problems</p>
          </div>
          
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 mb-8 transition-all duration-300 hover:bg-gray-800/50 border border-gray-700/50">
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              {/* Mobile: Flex container for textarea and button side by side */}
              <div className="md:hidden flex space-x-4">
                <div className="relative group flex-grow">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="w-full h-40 p-4 bg-gray-900/50 text-gray-100 rounded-2xl border border-gray-700 group-hover:border-gray-600 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none transition-all duration-300 resize-none"
                    placeholder="Describe your problem here..."
                    disabled={loading}
                  />
                  <div className="absolute bottom-4 right-4 text-gray-400 text-sm">
                    {prompt.length}
                  </div>
                </div>
                
                {/* Mobile: Vertical submit button */}
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="h-40 px-4 bg-gradient-to-b from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-gray-100 rounded-2xl font-semibold shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700/50 flex flex-col items-center justify-center space-y-2"
                >
                  {loading ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="rotate-90 transform origin-center whitespace-nowrap">Send</span>
                    </>
                  )}
                </button>
              </div>

              {/* Desktop: Original textarea layout */}
              <div className="hidden md:block relative group">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="w-full h-40 p-4 bg-gray-900/50 text-gray-100 rounded-2xl border border-gray-700 group-hover:border-gray-600 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none transition-all duration-300 resize-none"
                  placeholder="Describe your problem here... (Press Enter to submit)"
                  disabled={loading}
                />
                <div className="absolute bottom-4 right-4 text-gray-400 text-sm">
                  {prompt.length} characters
                </div>
              </div>

              {/* Desktop submit button - remains the same */}
              <div className="hidden md:flex justify-between items-center">
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-gray-100 rounded-2xl font-semibold shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 border border-gray-700/50"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  ) : (
                    'Get Solution'
                  )}
                </button>

                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </div>
            </form>
          </div>

          {(response || loading) && (
            <div ref={responseRef} className="bg-gray-800/40 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 animate-fade-in transition-all duration-300 hover:bg-gray-800/50 border border-gray-700/50">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-300">
                  Solution
                </h2>
                {response && !loading && (
                  <button
                    onClick={handleCopy}
                    className="text-gray-400 hover:text-gray-300 transition-colors flex items-center space-x-2"
                  >
                    {copied ? (
                      <span className="text-green-400">Copied!</span>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="prose prose-invert max-w-none">
                {loading ? (
                  <div className="h-20 flex items-center justify-center">
                    <div className="text-gray-400 animate-pulse">Processing your request...</div>
                  </div>
                ) : (
                  <div className="space-y-4">{formatResponseText(response)}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 