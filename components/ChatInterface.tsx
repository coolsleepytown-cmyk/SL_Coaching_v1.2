
import React, { useState, useRef, useEffect } from 'react';
import { Message, Scenario } from '../types';
import { Button } from './Button';

interface ChatInterfaceProps {
  scenario: Scenario;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onFinishSession: () => void;
  isAnalyzing: boolean;
  isChatting: boolean; // Is the bot typing?
  userName?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  scenario, 
  messages, 
  onSendMessage,
  onFinishSession,
  isAnalyzing,
  isChatting,
  userName = '나'
}) => {
  const [inputText, setInputText] = useState('');
  const [remainingTime, setRemainingTime] = useState(300); // 5 minutes in seconds
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Timer logic (Countdown)
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isChatting]);

  // Auto-focus when bot finishes chatting
  useEffect(() => {
    if (!isChatting && !isAnalyzing) {
      // Small timeout to ensure DOM is ready and state is settled
      const timeout = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isChatting, isAnalyzing]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isChatting || isAnalyzing) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Block submission if bot is typing, but don't disable the input to lose focus
      if (!isChatting && !isAnalyzing) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200 my-4 h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="font-bold text-lg">{scenario.employeeName} ({scenario.employeeRole})</h2>
            <p className="text-indigo-100 text-xs">{scenario.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
             <div className="text-indigo-200 text-xs uppercase tracking-wide">남은 시간</div>
             <div className={`font-mono font-bold text-lg w-16 ${remainingTime < 60 ? 'text-red-300 animate-pulse' : ''}`}>
                {formatTime(remainingTime)}
             </div>
          </div>
          <Button 
            variant="danger" 
            size="sm" 
            onClick={onFinishSession} 
            disabled={isAnalyzing || isChatting}
            className="border border-white/20"
          >
            대화 종료 및 분석
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
        {/* Scenario Context Box */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-8 text-sm text-indigo-900 mx-auto max-w-2xl text-center shadow-sm">
          <p className="font-semibold mb-1">상황 설정</p>
          {scenario.description}
          <div className="mt-2 text-xs bg-indigo-100 inline-block px-2 py-1 rounded">
            Target Level: <strong>{scenario.developmentLevel}</strong>
          </div>
        </div>

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
              
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-emerald-600 text-white'
              }`}>
                {msg.role === 'user' ? (userName ? userName[0] : '나') : scenario.employeeName[0]}
              </div>

              {/* Bubble */}
              <div className={`px-5 py-3 rounded-2xl shadow-sm text-base leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        
        {isChatting && (
          <div className="flex justify-start">
             <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-200 ml-11">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
             </div>
          </div>
        )}

        {isAnalyzing && (
           <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm text-center">
                 <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                 <h3 className="text-xl font-bold text-slate-800 mb-2">대화 분석 중...</h3>
                 <p className="text-slate-500">전체 대화 맥락과 리더십 스타일을<br/>정밀 분석하고 있습니다.</p>
              </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isChatting ? "상대방이 입력 중입니다..." : `${userName}님, 답변을 입력하세요...`}
            // Do not disable input while chatting to maintain focus, just block submit logic
            disabled={isAnalyzing}
            className="w-full pl-4 pr-4 py-3 bg-slate-100 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none max-h-32 text-slate-800 placeholder-slate-400 disabled:opacity-50"
            rows={1}
            autoFocus
          />
          <Button 
            type="submit" 
            disabled={!inputText.trim() || isAnalyzing || isChatting}
            className="rounded-xl h-[48px] w-[48px] !p-0 flex items-center justify-center shrink-0"
          >
            <svg className="w-5 h-5 translate-x-0.5 -translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-2">
           5분 정도 대화를 나눈 후 [대화 종료] 버튼을 눌러 피드백을 확인하세요.
        </p>
      </div>
    </div>
  );
};
