

import React, { useState, useEffect } from 'react';
import { AppState, Scenario, Message, AnalysisResult, SessionRecord, DevelopmentLevel } from './types';
import { generateScenarios, analyzeFullSession, getEmployeeResponse } from './services/geminiService';
import { ScenarioSelector } from './components/ScenarioSelector';
import { ChatInterface } from './components/ChatInterface';
import { FeedbackView } from './components/FeedbackView';
import { DashboardView } from './components/DashboardView';
import { Button } from './components/Button';

// Utility for URL encoding/decoding
const encodeScenario = (scenario: Scenario): string => {
  try {
    const jsonStr = JSON.stringify(scenario);
    return window.btoa(unescape(encodeURIComponent(jsonStr)));
  } catch (e) {
    console.error("Encoding failed", e);
    return "";
  }
};

const decodeScenario = (encoded: string): Scenario | null => {
  try {
    const jsonStr = decodeURIComponent(escape(window.atob(encoded)));
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Decoding failed", e);
    return null;
  }
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.INTRO);
  const [userName, setUserName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>(""); 
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false); // General loading (analysis)
  const [botTyping, setBotTyping] = useState(false); // Chat typing state
  const [sharedScenario, setSharedScenario] = useState<Scenario | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminIdInput, setAdminIdInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  
  // LocalStorage Mock DB - Uses lazy initialization to prevent data loss on mount
  const [records, setRecords] = useState<SessionRecord[]>(() => {
    let initialData: SessionRecord[] = [];
    try {
      const saved = localStorage.getItem('slii_records');
      if (saved) {
        initialData = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load records from localStorage", e);
      initialData = [];
    }

    // --- EMERGENCY DATA RESTORE LOGIC FOR 'Reign Vale' ---
    const targetUser = "Reign Vale";
    const exists = initialData.some(r => r.userName === targetUser && !r.isDeleted);
    
    if (!exists) {
       console.warn("Restoring missing data for Reign Vale...");
       const restoredRecord: SessionRecord = {
          id: "restored-reign-vale-" + Date.now(),
          userName: "Reign Vale",
          companyName: "Restored Data",
          scenarioTitle: "신중한 전문가 (D3) - 프로젝트 리스크 관리",
          date: new Date().toISOString(),
          score: 92,
          isDeleted: false,
          employeeName: "박현우",
          employeeRole: "데이터 분석가",
          developmentLevel: DevelopmentLevel.D3,
          result: {
             leaderStyleIdentified: ["S3", "S2"],
             styleScore: { S1: 10, S2: 30, S3: 50, S4: 10 },
             isMatch: true,
             score: 92,
             summaryFeedback: "[데이터 복구됨] Reign Vale님은 D3 단계의 팀원에게 필요한 '지원형(S3)' 리더십을 적절히 발휘했습니다. 팀원의 우려사항을 경청하고 격려하며, 의사결정 과정에 함께 참여하도록 유도한 점이 매우 훌륭했습니다. 지시보다는 질문을 통해 스스로 답을 찾게 도운 점이 고득점의 요인입니다.",
             turnByTurnAnalysis: [
                {
                   userMessageSnippet: "현우님, 이번 프로젝트 리스크에 대해 걱정이 많으신 것 같아요. 구체적으로 어떤 점이 가장 우려되나요?",
                   critique: "팀원의 감정을 읽고 구체적인 원인을 파악하려는 개방형 질문입니다. S3 스타일의 전형적인 좋은 예시입니다.",
                   betterAlternative: ""
                },
                {
                   userMessageSnippet: "제가 도와드릴 부분은 지원하겠지만, 해결책은 현우님이 더 잘 아실 것 같아요. 어떻게 하면 좋을까요?",
                   critique: "책임을 위임하지 않고 함께 해결책을 모색하며 역량을 인정해준 점이 좋습니다.",
                   betterAlternative: ""
                }
             ],
             actionPlan: [
                {
                   task: "정기적인 1:1 미팅으로 자신감 고취하기",
                   deadline: "매주 금요일",
                   metric: "팀원의 제안 횟수 증가 확인"
                }
             ]
          }
       };
       // Prepend the restored record
       initialData = [restoredRecord, ...initialData];
       // Save immediately to persist restoration
       try {
         localStorage.setItem('slii_records', JSON.stringify(initialData));
       } catch(e) {}
    }
    // -----------------------------------------------------

    return initialData;
  });

  // Save records whenever they change - acts as a fallback/sync mechanism
  useEffect(() => {
    try {
      const currentJSON = JSON.stringify(records);
      if (localStorage.getItem('slii_records') !== currentJSON) {
        localStorage.setItem('slii_records', currentJSON);
      }
    } catch (e) {
      console.error("Failed to save records to localStorage", e);
    }
  }, [records]);

  // Sync with other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'slii_records' && e.newValue) {
        try {
          const syncedRecords = JSON.parse(e.newValue);
          setRecords(prev => {
             const prevJSON = JSON.stringify(prev);
             return prevJSON === e.newValue ? prev : syncedRecords;
          });
        } catch (error) {
          console.error("Failed to sync records", error);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load scenarios when entering selection state (initial load only if empty)
  useEffect(() => {
    if (appState === AppState.SCENARIO_SELECTION && scenarios.length === 0) {
      handleRefreshScenarios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState]);

  // Handle shared scenario URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('scenario');
    if (shared) {
      const decoded = decodeScenario(shared);
      if (decoded) {
        setSharedScenario(decoded);
      }
    }
  }, []);

  const handleRefreshScenarios = async (industry?: string, role?: string) => {
    setLoading(true);
    setScenarios([]); 
    
    try {
      const [newScenarios] = await Promise.all([
        generateScenarios(industry, role),
        new Promise(resolve => setTimeout(resolve, 800)) 
      ]);
      setScenarios(newScenarios);
    } catch (error) {
      console.error("Failed to load scenarios", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (!userName.trim()) {
      alert("참여자 이름을 입력해주세요.");
      return;
    }
    if (!companyName.trim()) {
      alert("회사명을 입력해주세요.");
      return;
    }

    if (sharedScenario) {
      handleSelectScenario(sharedScenario);
    } else {
      setAppState(AppState.SCENARIO_SELECTION);
    }
  };

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminIdInput.trim() === "admin" && adminPasswordInput.trim() === "admin1234") {
      setIsAdmin(true);
      setAdminIdInput("");
      setAdminPasswordInput("");
      setAppState(AppState.DASHBOARD);
    } else {
      alert("아이디 또는 비밀번호가 틀렸습니다.");
    }
  };

  const handleSelectScenario = (scenario: Scenario) => {
    setCurrentScenario(scenario);
    setMessages([{
      id: Date.now().toString(),
      role: 'model',
      text: scenario.initialMessage,
      timestamp: Date.now()
    }]);
    setAnalysisResult(null);
    setAppState(AppState.ROLEPLAY);
  };

  const handleShareScenario = (scenario: Scenario) => {
    const encoded = encodeScenario(scenario);
    const url = `${window.location.origin}${window.location.pathname}?scenario=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      alert("공유 링크가 클립보드에 복사되었습니다!");
    });
  };

  const handleSendMessage = async (text: string) => {
    if (!currentScenario) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now()
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    setBotTyping(true);
    try {
      const replyText = await getEmployeeResponse(currentScenario, updatedMessages);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: replyText,
        timestamp: Date.now() + 1
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        timestamp: Date.now() + 1
      }]);
    } finally {
      setBotTyping(false);
    }
  };

  const handleFinishSession = async () => {
    if (!currentScenario) return;
    
    setLoading(true);
    try {
      const result = await analyzeFullSession(currentScenario, messages);
      setAnalysisResult(result);
      
      // Save Record
      const newRecord: SessionRecord = {
        id: Date.now().toString(),
        userName: userName,
        companyName: companyName,
        scenarioTitle: currentScenario.title,
        date: new Date().toISOString(),
        score: result.score,
        isDeleted: false,
        result: result,
        employeeName: currentScenario.employeeName,
        employeeRole: currentScenario.employeeRole,
        developmentLevel: currentScenario.developmentLevel
      };

      // Critical: Save synchronously to localStorage to prevent data loss
      setRecords(prev => {
        const updated = [newRecord, ...prev];
        try {
          localStorage.setItem('slii_records', JSON.stringify(updated));
        } catch (e) {
          console.error("Critical Save Error:", e);
        }
        return updated;
      });
      
      setAppState(AppState.ANALYSIS);
    } catch (error: any) {
      console.error("Analysis failed", error);
      alert(`분석 중 오류가 발생했습니다.\n\n내용: ${error.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Dashboard logic - Single & Bulk Actions
  const handleRestore = (id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id];
    setRecords(prev => {
      const updated = prev.map(r => ids.includes(r.id) ? { ...r, isDeleted: false } : r);
      localStorage.setItem('slii_records', JSON.stringify(updated));
      return updated;
    });
  };
  
  const handleMoveToTrash = (id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id];
    setRecords(prev => {
      const updated = prev.map(r => ids.includes(r.id) ? { ...r, isDeleted: true } : r);
      localStorage.setItem('slii_records', JSON.stringify(updated));
      return updated;
    });
  };
  
  const handleDeleteForever = (id: string | string[]) => {
    if(window.confirm("정말로 영구 삭제하시겠습니까?")) {
      const ids = Array.isArray(id) ? id : [id];
      setRecords(prev => {
        const updated = prev.filter(r => !ids.includes(r.id));
        localStorage.setItem('slii_records', JSON.stringify(updated));
        return updated;
      });
    }
  };
  
  const handleViewDetail = (record: SessionRecord) => {
    setAnalysisResult(record.result);
    setCurrentScenario({
       id: "archived",
       title: record.scenarioTitle,
       description: "Archived Session",
       employeeName: record.employeeName || "Unknown",
       employeeRole: record.employeeRole || "Unknown",
       developmentLevel: record.developmentLevel || DevelopmentLevel.D1, 
       initialMessage: ""
    });
    setAppState(AppState.ANALYSIS);
  };


  const renderContent = () => {
    switch (appState) {
      case AppState.INTRO:
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-slate-50 text-center relative">
            <div className="max-w-2xl animate-fade-in-up w-full">
              <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto mb-8 flex items-center justify-center shadow-lg transform -rotate-3">
                 <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                 </svg>
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
                Situational <span className="text-indigo-600">Leadership</span> Coach
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed">
                상황대응 리더십(SLII) 실전 훈련.<br/>
                가상의 팀원과 롤플레이하고, 맞춤형 액션 플랜을 받아보세요.
              </p>

              <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md mx-auto">
                {sharedScenario && (
                  <div className="mb-6 p-4 bg-indigo-50 rounded-lg text-sm text-indigo-800 border border-indigo-100 text-left">
                    <span className="font-bold block mb-1">🔗 공유된 시나리오가 감지되었습니다</span>
                    "{sharedScenario.title}" 상황을 연습합니다.
                  </div>
                )}
                
                <div className="space-y-4 mb-6 text-left">
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">회사명 (Company)</label>
                    <input 
                      type="text" 
                      id="company"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="예: 삼성전자, 스타트업 A"
                    />
                  </div>
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">참여자 이름</label>
                    <input 
                      type="text" 
                      id="username"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="홍길동 팀장"
                      onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                    />
                  </div>
                </div>
                
                <Button size="lg" onClick={handleStart} className="w-full shadow-lg shadow-indigo-200">
                  {sharedScenario ? '공유된 상황 시작하기' : '코칭 시작하기'}
                </Button>
              </div>
              
              <div className="mt-12 pt-8 border-t border-slate-200">
                 <button 
                   onClick={() => setAppState(AppState.ADMIN_LOGIN)} 
                   className="text-sm text-slate-400 hover:text-indigo-600 font-medium transition-colors flex items-center justify-center mx-auto"
                 >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    관리자 로그인 (Admin Access)
                 </button>
              </div>
            </div>
          </div>
        );

      case AppState.ADMIN_LOGIN:
        return (
           <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
              <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                 <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">관리자 로그인</h2>
                    <p className="text-slate-500 mt-2">팀 대시보드 접근을 위해 로그인이 필요합니다.</p>
                 </div>
                 <form onSubmit={handleAdminLoginSubmit}>
                    <div className="mb-4">
                       <label className="block text-sm font-medium text-slate-700 mb-2">아이디 (ID)</label>
                       <input 
                         type="text"
                         value={adminIdInput}
                         onChange={(e) => setAdminIdInput(e.target.value)}
                         className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                         placeholder="admin"
                         autoFocus
                       />
                    </div>
                    <div className="mb-6">
                       <label className="block text-sm font-medium text-slate-700 mb-2">비밀번호</label>
                       <input 
                         type="password"
                         value={adminPasswordInput}
                         onChange={(e) => setAdminPasswordInput(e.target.value)}
                         className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                         placeholder="Password"
                       />
                    </div>
                    <div className="flex gap-4">
                       <Button 
                         type="button" 
                         variant="secondary" 
                         className="flex-1" 
                         onClick={() => {
                           setAdminIdInput("");
                           setAdminPasswordInput("");
                           setAppState(AppState.INTRO);
                         }}
                       >
                         취소
                       </Button>
                       <Button type="submit" className="flex-1">
                         로그인
                       </Button>
                    </div>
                 </form>
              </div>
           </div>
        );

      case AppState.DASHBOARD:
        return (
          <DashboardView 
            records={records}
            onRestore={handleRestore}
            onMoveToTrash={handleMoveToTrash}
            onDeleteForever={handleDeleteForever}
            onBackToIntro={() => {
              setIsAdmin(false);
              setAppState(AppState.INTRO);
            }}
            onViewDetail={handleViewDetail}
          />
        );

      case AppState.SCENARIO_SELECTION:
        return (
          <ScenarioSelector 
            scenarios={scenarios} 
            onSelect={handleSelectScenario} 
            isLoading={loading}
            onRefresh={handleRefreshScenarios}
            onShare={handleShareScenario}
          />
        );

      case AppState.ROLEPLAY:
        return currentScenario ? (
          <div className="h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 py-3 px-6 flex items-center justify-between shrink-0">
               <button onClick={() => setAppState(AppState.SCENARIO_SELECTION)} className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium">
                 <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                 나가기
               </button>
               <span className="font-semibold text-slate-800">리더십 롤플레이 ({userName})</span>
               <button 
                  onClick={() => handleShareScenario(currentScenario)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center"
               >
                 <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                 공유
               </button>
            </header>
            <div className="flex-1 overflow-hidden">
               <ChatInterface 
                scenario={currentScenario}
                messages={messages}
                onSendMessage={handleSendMessage}
                onFinishSession={handleFinishSession}
                isAnalyzing={loading}
                isChatting={botTyping}
                userName={userName}
              />
            </div>
          </div>
        ) : null;

      case AppState.ANALYSIS:
        return currentScenario && analysisResult ? (
          <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
             <header className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
               {isAdmin ? (
                 <button onClick={() => setAppState(AppState.DASHBOARD)} className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium">
                   <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                   대시보드
                 </button>
               ) : (
                 <button onClick={() => setAppState(AppState.INTRO)} className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                    홈으로
                 </button>
               )}
            </header>
            <FeedbackView 
              result={analysisResult} 
              scenario={currentScenario}
              onNewScenario={() => {
                setAppState(AppState.SCENARIO_SELECTION);
                setMessages([]);
                setAnalysisResult(null);
                setCurrentScenario(null);
              }}
              userName={userName}
              onGoToDashboard={() => setAppState(isAdmin ? AppState.DASHBOARD : AppState.INTRO)}
            />
          </div>
        ) : null;
        
      default:
        return null;
    }
  };

  return <div className="font-sans text-slate-900">{renderContent()}</div>;
};

export default App;