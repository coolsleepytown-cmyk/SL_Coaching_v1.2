

import React, { useState, useMemo } from 'react';
import { SessionRecord, TeamAnalysisResult } from '../types';
import { Button } from './Button';
import { generateTeamAnalysis } from '../services/geminiService';

interface DashboardViewProps {
  records: SessionRecord[];
  onRestore: (id: string | string[]) => void;
  onDeleteForever: (id: string | string[]) => void;
  onMoveToTrash: (id: string | string[]) => void;
  onBackToIntro: () => void;
  onViewDetail: (record: SessionRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  records,
  onRestore,
  onDeleteForever,
  onMoveToTrash,
  onBackToIntro,
  onViewDetail
}) => {
  const [view, setView] = useState<'active' | 'trash'>('active');
  const [isGenerating, setIsGenerating] = useState(false);
  const [teamReport, setTeamReport] = useState<TeamAnalysisResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof SessionRecord; direction: 'asc' | 'desc' } | null>(null);

  const displayedRecords = records.filter(r => view === 'active' ? !r.isDeleted : r.isDeleted);
  const activeRecords = records.filter(r => !r.isDeleted);
  
  const avgScore = activeRecords.length > 0 
    ? Math.round(activeRecords.reduce((acc, curr) => acc + curr.score, 0) / activeRecords.length) 
    : 0;

  // Sorting Logic
  const sortedRecords = useMemo(() => {
    let items = [...displayedRecords];
    if (sortConfig !== null) {
      items.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        // Handle optional or missing values safely
        if (aValue === undefined || aValue === null) aValue = "";
        if (bValue === undefined || bValue === null) bValue = "";
        
        // Case insensitive string comparison
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return items;
  }, [displayedRecords, sortConfig]);

  const requestSort = (key: keyof SessionRecord) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof SessionRecord) => {
    if (!sortConfig || sortConfig.key !== key) {
       return <svg className="w-3 h-3 text-slate-300 ml-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24"><path d="M12 16l-4-4h8l-4 4zm0-8l4 4H8l4-4z" /></svg>;
    }
    if (sortConfig.direction === 'asc') {
       return <svg className="w-3 h-3 text-indigo-600 ml-1 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M8 14l4-4 4 4H8z" /></svg>;
    }
    return <svg className="w-3 h-3 text-indigo-600 ml-1 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M8 10l4 4 4-4H8z" /></svg>;
  };

  // Handle Select All
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = displayedRecords.map(r => r.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Handle Single Select
  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = (action: 'trash' | 'restore' | 'delete') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (action === 'trash') {
      if (window.confirm(`${ids.length}개의 항목을 휴지통으로 이동하시겠습니까?`)) {
        onMoveToTrash(ids);
        setSelectedIds(new Set());
      }
    } else if (action === 'restore') {
      if (window.confirm(`${ids.length}개의 항목을 복원하시겠습니까?`)) {
        onRestore(ids);
        setSelectedIds(new Set());
      }
    } else if (action === 'delete') {
      if (window.confirm(`${ids.length}개의 항목을 영구 삭제하시겠습니까?`)) {
        onDeleteForever(ids);
        setSelectedIds(new Set());
      }
    }
  };

  const handleGenerateReport = async () => {
    // Logic: Use selected records if available, otherwise use all active records
    let recordsToAnalyze = activeRecords;
    
    if (selectedIds.size > 0) {
      recordsToAnalyze = activeRecords.filter(r => selectedIds.has(r.id));
    }

    if (recordsToAnalyze.length === 0) {
      alert("분석할 데이터가 없습니다.");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateTeamAnalysis(recordsToAnalyze);
      setTeamReport(result);
    } catch (error) {
      alert("리포트 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    const element = document.getElementById('team-report-content');
    if (window.html2pdf) {
      const opt = {
        margin: 10,
        filename: `Team_Analysis_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      window.html2pdf().set(opt).from(element).save();
    } else {
      window.print();
    }
  };

  const handleSendEmail = () => {
    if (!teamReport) return;

    const subject = `[SLII Team Report] 팀 리더십 분석 결과 (${new Date().toLocaleDateString()})`;
    const body = `
[SLII 팀 리더십 분석 결과 리포트]

생성일: ${new Date().toLocaleDateString()}
참여 세션: ${teamReport.participantCount}건
팀 평균 점수: ${teamReport.overallScore}점

--------------------------------------------------
[Executive Summary]
${teamReport.executiveSummary}

[리더십 스타일 평균 분포 (Average Usage)]
S1: ${teamReport.styleDistribution.S1 || 0}%
S2: ${teamReport.styleDistribution.S2 || 0}%
S3: ${teamReport.styleDistribution.S3 || 0}%
S4: ${teamReport.styleDistribution.S4 || 0}%

[강점 (Key Strengths)]
${teamReport.keyStrengths.map(s => `- ${s}`).join('\n')}

[개선점 (Weaknesses)]
${teamReport.commonWeaknesses.map(w => `- ${w}`).join('\n')}
--------------------------------------------------

* 상세 그래프와 교육 권장 사항은 첨부된 PDF 파일을 확인해주세요.
    `.trim();

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'S1': return 'bg-red-500';
      case 'S2': return 'bg-orange-500';
      case 'S3': return 'bg-blue-500';
      case 'S4': return 'bg-green-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 relative">
       <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">팀 코칭 대시보드</h1>
          <Button variant="outline" onClick={onBackToIntro}>메인으로 돌아가기</Button>
       </div>

       {/* Stats Cards */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-sm text-slate-500 font-medium uppercase">총 코칭 세션</div>
             <div className="text-3xl font-bold text-slate-900 mt-2">{activeRecords.length}건</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-sm text-slate-500 font-medium uppercase">팀 평균 점수</div>
             <div className={`text-3xl font-bold mt-2 ${avgScore >= 80 ? 'text-green-600' : avgScore >= 50 ? 'text-yellow-600' : 'text-slate-600'}`}>
               {avgScore}점
             </div>
          </div>
          <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex flex-col items-center justify-center text-center hover:bg-indigo-100 transition-colors cursor-pointer" onClick={handleGenerateReport}>
             {isGenerating ? (
               <div className="flex flex-col items-center">
                 <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                 <span className="text-sm font-bold text-indigo-700">분석 중...</span>
               </div>
             ) : (
               <>
                 <svg className="w-8 h-8 text-indigo-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 <span className="text-sm font-bold text-indigo-700">
                   {selectedIds.size > 0 ? `선택된 ${selectedIds.size}명 리포트 생성` : '전체 팀 리포트 생성'}
                 </span>
               </>
             )}
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
             <div className="text-center">
                <span className="block text-sm text-slate-400 mb-1">데이터 관리</span>
                <div className="flex gap-2">
                   <button 
                     onClick={() => { setView('active'); setSelectedIds(new Set()); }}
                     className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${view === 'active' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
                   >
                     운영
                   </button>
                   <button 
                     onClick={() => { setView('trash'); setSelectedIds(new Set()); }}
                     className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${view === 'trash' ? 'bg-red-100 text-red-700' : 'text-slate-500 hover:bg-slate-100'}`}
                   >
                     휴지통
                   </button>
                </div>
             </div>
          </div>
       </div>

       {/* Bulk Actions Bar */}
       {selectedIds.size > 0 && (
         <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4 flex items-center justify-between animate-fade-in-up">
           <span className="text-indigo-800 text-sm font-medium ml-2">
             {selectedIds.size}개 선택됨
           </span>
           <div className="flex gap-2">
             {view === 'active' ? (
                <button 
                  onClick={() => handleBulkAction('trash')}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 rounded text-sm font-medium transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  선택 삭제
                </button>
             ) : (
                <>
                  <button 
                    onClick={() => handleBulkAction('restore')}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-green-600 hover:bg-green-50 hover:border-green-200 rounded text-sm font-medium transition-colors flex items-center"
                  >
                     <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     선택 복원
                  </button>
                  <button 
                    onClick={() => handleBulkAction('delete')}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 rounded text-sm font-medium transition-colors flex items-center"
                  >
                     <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     선택 영구 삭제
                  </button>
                </>
             )}
           </div>
         </div>
       )}

       {/* Team Report Modal */}
       {teamReport && (
         <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
               <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
                  <h2 className="text-xl font-bold text-slate-900">팀 분석 리포트 결과</h2>
                  <div className="flex gap-2">
                     <Button variant="outline" onClick={handleSendEmail} className="hidden md:inline-flex">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        이메일 발송
                     </Button>
                     <Button variant="primary" onClick={handleDownloadReport}>PDF 다운로드</Button>
                     <button onClick={() => setTeamReport(null)} className="p-2 text-slate-400 hover:text-slate-600">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                  </div>
               </div>
               
               <div id="team-report-content" className="p-8 space-y-8 bg-white">
                  <div className="text-center border-b border-slate-100 pb-6">
                     <h1 className="text-3xl font-bold text-slate-800 mb-2">Team Leadership Analysis</h1>
                     <p className="text-slate-500">생성일: {new Date().toLocaleDateString()}</p>
                     <p className="text-sm text-indigo-600 mt-1">{teamReport.participantCount}명의 데이터 기반 분석</p>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                     <h3 className="text-indigo-900 font-bold mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Executive Summary
                     </h3>
                     <p className="text-indigo-800 leading-relaxed whitespace-pre-wrap">{teamReport.executiveSummary}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                     {/* Stats - Changed to Average Usage Distribution */}
                     <div>
                        <h4 className="font-bold text-slate-800 mb-4 border-b pb-2">팀 평균 리더십 스타일 분포</h4>
                        <div className="space-y-4">
                           {['S1', 'S2', 'S3', 'S4'].map((style) => {
                              const percentage = teamReport.styleDistribution[style] || 0;
                              return (
                                 <div key={style} className="flex items-center">
                                    <span className="w-8 font-bold text-slate-600">{style}</span>
                                    <div className="flex-1 mx-3">
                                       <div className="flex justify-between text-xs text-slate-500 mb-1">
                                          <span>Usage</span>
                                          <span className="font-bold">{percentage}%</span>
                                       </div>
                                       <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                                          <div 
                                            className={`h-full ${getStyleColor(style)}`} 
                                            style={{ width: `${percentage}%` }}
                                          ></div>
                                       </div>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-right">* 팀원들이 각 스타일을 사용한 평균 비율</p>
                     </div>

                     {/* Strengths */}
                     <div>
                        <h4 className="font-bold text-slate-800 mb-4 border-b pb-2 text-green-700">팀 강점 (Key Strengths)</h4>
                        <ul className="space-y-2">
                           {teamReport.keyStrengths.map((str, idx) => (
                              <li key={idx} className="flex items-start text-sm text-slate-700">
                                 <svg className="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                 {str}
                              </li>
                           ))}
                        </ul>
                     </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                      {/* Weaknesses */}
                     <div>
                        <h4 className="font-bold text-slate-800 mb-4 border-b pb-2 text-orange-700">개선 필요점 (Weaknesses)</h4>
                        <ul className="space-y-2">
                           {teamReport.commonWeaknesses.map((weak, idx) => (
                              <li key={idx} className="flex items-start text-sm text-slate-700">
                                 <svg className="w-5 h-5 text-orange-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                 {weak}
                              </li>
                           ))}
                        </ul>
                     </div>
                     
                     {/* Recommendations */}
                     <div>
                        <h4 className="font-bold text-slate-800 mb-4 border-b pb-2 text-indigo-700">교육 권장 사항</h4>
                        <ul className="space-y-2">
                           {teamReport.trainingRecommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start text-sm text-slate-700 bg-slate-50 p-2 rounded">
                                 <span className="font-bold text-indigo-500 mr-2">{idx + 1}.</span>
                                 {rec}
                              </li>
                           ))}
                        </ul>
                     </div>
                  </div>
               </div>
            </div>
         </div>
       )}

       {/* Table */}
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
             <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                   <th className="px-6 py-4 w-12 text-center">
                     <input 
                       type="checkbox" 
                       onChange={handleSelectAll} 
                       checked={displayedRecords.length > 0 && selectedIds.size === displayedRecords.length}
                       disabled={displayedRecords.length === 0}
                       className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                     />
                   </th>
                   <th 
                      className="px-6 py-4 font-semibold text-slate-900 cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                      onClick={() => requestSort('companyName')}
                   >
                     회사명 {getSortIcon('companyName')}
                   </th>
                   <th 
                      className="px-6 py-4 font-semibold text-slate-900 cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                      onClick={() => requestSort('date')}
                   >
                     날짜 {getSortIcon('date')}
                   </th>
                   <th className="px-6 py-4 font-semibold text-slate-900">참여자</th>
                   <th className="px-6 py-4 font-semibold text-slate-900">시나리오</th>
                   <th className="px-6 py-4 font-semibold text-slate-900">점수</th>
                   <th className="px-6 py-4 font-semibold text-slate-900 text-right">관리</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {sortedRecords.length === 0 ? (
                   <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                         데이터가 없습니다.
                      </td>
                   </tr>
                ) : (
                   sortedRecords.map((record) => (
                      <tr key={record.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(record.id) ? 'bg-indigo-50/50' : ''}`}>
                         <td className="px-6 py-4 text-center">
                            <input 
                              type="checkbox"
                              checked={selectedIds.has(record.id)}
                              onChange={() => handleSelectOne(record.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            />
                         </td>
                         <td className="px-6 py-4 text-slate-600 font-medium">{record.companyName || '-'}</td>
                         <td className="px-6 py-4">{new Date(record.date).toLocaleDateString()}</td>
                         <td className="px-6 py-4 font-medium text-slate-900">{record.userName}</td>
                         <td className="px-6 py-4 truncate max-w-[200px]" title={record.scenarioTitle}>{record.scenarioTitle}</td>
                         <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                               record.score >= 80 ? 'bg-green-100 text-green-700' :
                               record.score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                            }`}>
                               {record.score}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                            {view === 'active' ? (
                               <>
                                 <button onClick={() => onViewDetail(record)} className="text-indigo-600 hover:text-indigo-900 font-medium text-xs md:text-sm">결과보기</button>
                                 <button onClick={() => onMoveToTrash(record.id)} className="text-slate-400 hover:text-red-600 text-xs md:text-sm">휴지통</button>
                               </>
                            ) : (
                               <>
                                 <button onClick={() => onRestore(record.id)} className="text-green-600 hover:text-green-900 font-medium text-xs md:text-sm">복원</button>
                                 <button onClick={() => onDeleteForever(record.id)} className="text-red-600 hover:text-red-900 font-medium text-xs md:text-sm">삭제</button>
                               </>
                            )}
                         </td>
                      </tr>
                   ))
                )}
             </tbody>
          </table>
       </div>
    </div>
  );
};
