
import React from 'react';
import { AnalysisResult, Scenario } from '../types';
import { Button } from './Button';

interface FeedbackViewProps {
  result: AnalysisResult;
  scenario: Scenario;
  onNewScenario: () => void;
  userName?: string;
  onGoToDashboard: () => void;
}

export const FeedbackView: React.FC<FeedbackViewProps> = ({ 
  result, 
  scenario, 
  onNewScenario,
  userName,
  onGoToDashboard
}) => {
  const scoreColor = result.score >= 80 ? 'text-green-600' : result.score >= 50 ? 'text-yellow-600' : 'text-red-600';

  // Handle both string (legacy) and array (new) format for styles if needed for text
  const styles: string[] = Array.isArray(result.leaderStyleIdentified) 
    ? result.leaderStyleIdentified 
    : [result.leaderStyleIdentified as string];

  // Default distribution if missing (Legacy compatibility)
  const styleScore = result.styleScore || { 
    S1: styles.includes('S1') ? 50 : 0, 
    S2: styles.includes('S2') ? 50 : 0, 
    S3: styles.includes('S3') ? 50 : 0, 
    S4: styles.includes('S4') ? 50 : 0 
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('report-content');
    if (window.html2pdf) {
      const opt = {
        margin: [10, 10, 10, 10], // top, left, bottom, right in mm
        filename: `Coaching_Result_${userName || 'User'}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      // Temporarily remove shadow for clean print
      if (element) {
        element.classList.remove('shadow-xl');
        element.classList.remove('border');
      }

      window.html2pdf().set(opt).from(element).save().then(() => {
        // Restore styles
        if (element) {
          element.classList.add('shadow-xl');
          element.classList.add('border');
        }
      });
    } else {
      window.print();
    }
  };

  const handleSendEmail = () => {
    const subject = `[SLII 코칭 결과] ${userName || '참여자'} - ${scenario.title}`;
    const body = `
[SLII 리더십 코칭 결과 리포트]

참여자: ${userName || '참여자'}
시나리오: ${scenario.title} (${scenario.employeeName}, ${scenario.developmentLevel})
진단 일자: ${new Date().toLocaleDateString()}

--------------------------------------------------
🏆 종합 점수: ${result.score}점
📊 주요 리더십 스타일: ${styles.join(', ')} (${result.isMatch ? '적절함' : '부적절함'})
--------------------------------------------------

[리더십 스타일 분포]
S1 (Directing): ${styleScore.S1}%
S2 (Coaching): ${styleScore.S2}%
S3 (Supporting): ${styleScore.S3}%
S4 (Delegating): ${styleScore.S4}%

[종합 피드백]
${result.summaryFeedback}

[주요 실천 과제]
${result.actionPlan.map((plan, idx) => `${idx + 1}. ${plan.task} (기한: ${plan.deadline})`).join('\n')}

* 상세한 분석 내용은 PDF를 다운로드하여 첨부해주세요.
    `.trim();

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const getStyleDescription = (style: string) => {
    switch (style) {
      case 'S1': return '지시형 (Directing)';
      case 'S2': return '코칭형 (Coaching)';
      case 'S3': return '지원형 (Supporting)';
      case 'S4': return '위임형 (Delegating)';
      default: return style;
    }
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

  const getStyleBg = (style: string) => {
    switch (style) {
      case 'S1': return 'bg-red-50';
      case 'S2': return 'bg-orange-50';
      case 'S3': return 'bg-blue-50';
      case 'S4': return 'bg-green-50';
      default: return 'bg-slate-50';
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-8 px-4 md:px-0">
      {/* The Printable Report Container */}
      <div 
        id="report-content" 
        className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-200 animate-fade-in-up print:shadow-none print:border-none print:w-full print:p-0"
      >
        {/* Report Header */}
        <div className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-end">
          <div>
            <div className="text-indigo-600 font-bold text-sm tracking-wider uppercase mb-1">Situational Leadership Coach</div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">Coaching Analysis Report</h1>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-slate-500 text-sm">Date</div>
            <div className="font-semibold text-slate-800">{new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Participant Info & Score Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 bg-slate-50 p-6 rounded-xl border border-slate-100">
           <div className="col-span-1 md:col-span-2 space-y-3">
              <div className="flex items-center">
                 <span className="w-24 text-sm text-slate-500 font-bold uppercase">참여자</span>
                 <span className="text-lg font-bold text-slate-900">{userName || 'Unknown'}</span>
              </div>
              <div className="flex items-center">
                 <span className="w-24 text-sm text-slate-500 font-bold uppercase">시나리오</span>
                 <span className="text-slate-800">{scenario.title}</span>
              </div>
              <div className="flex items-center">
                 <span className="w-24 text-sm text-slate-500 font-bold uppercase">대상 레벨</span>
                 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                    {scenario.developmentLevel} ({scenario.employeeRole})
                 </span>
              </div>
           </div>
           <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 pl-0 md:pl-6">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Score</div>
              <div className={`text-6xl font-black ${scoreColor}`}>{result.score}</div>
              <div className="mt-2 text-sm font-medium text-slate-600">
                Style Match: <span className={result.isMatch ? "text-green-600" : "text-red-500"}>{result.isMatch ? "SUCCESS" : "MISMATCH"}</span>
              </div>
           </div>
        </div>

        {/* Overall Feedback */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3 uppercase tracking-wide border-b border-slate-200 pb-2">
              종합 피드백
          </h2>
          <div className="text-slate-700 leading-relaxed text-justify whitespace-pre-wrap">
            {result.summaryFeedback}
          </div>
        </section>

        {/* Style Distribution (New Graphic) */}
        <section className="mb-10 page-break-inside-avoid">
           <h2 className="text-lg font-bold text-slate-900 mb-6 uppercase tracking-wide border-b border-slate-200 pb-2">
              리더십 스타일 DNA (Style Distribution)
           </h2>
           
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['S1', 'S2', 'S3', 'S4'].map((styleKey) => {
                 const percentage = (styleScore as any)[styleKey] || 0;
                 return (
                    <div key={styleKey} className={`flex flex-col p-4 rounded-xl border ${percentage > 30 ? 'ring-2 ring-indigo-500 border-transparent' : 'border-slate-200'} ${getStyleBg(styleKey)} relative overflow-hidden`}>
                        <div className="flex justify-between items-end mb-2 relative z-10">
                           <span className="font-bold text-slate-700">{styleKey}</span>
                           <span className="text-2xl font-black text-slate-800">{percentage}%</span>
                        </div>
                        <div className="text-xs text-slate-500 mb-3 relative z-10 h-8">
                           {getStyleDescription(styleKey)}
                        </div>
                        
                        {/* Progress Bar Container */}
                        <div className="w-full bg-black/5 rounded-full h-2 mt-auto relative z-10">
                           <div 
                              className={`h-2 rounded-full ${getStyleColor(styleKey)}`} 
                              style={{ width: `${percentage}%` }}
                           ></div>
                        </div>
                    </div>
                 );
              })}
           </div>
           <p className="text-right text-xs text-slate-400 mt-2">* 사용된 리더십 스타일의 총합은 100%입니다.</p>
        </section>

        {/* Turn-by-Turn Analysis */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wide border-b border-slate-200 pb-2">
              대화 상세 분석
          </h2>
          <div className="space-y-6">
            {result.turnByTurnAnalysis.map((turn, idx) => (
              <div key={idx} className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200 break-inside-avoid shadow-sm">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                   <span className="font-bold text-slate-700 text-sm">Turn #{idx + 1}</span>
                </div>
                <div className="p-4 grid gap-4">
                   <div>
                      <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Manager (User)</span>
                      <p className="text-slate-800 font-medium text-sm bg-white p-2 rounded border border-slate-100">"{turn.userMessageSnippet}"</p>
                   </div>
                   <div className="flex gap-4">
                      <div className="flex-1">
                          <span className="text-xs text-orange-400 font-bold uppercase block mb-1">Critique</span>
                          <p className="text-sm text-slate-600 leading-snug">{turn.critique}</p>
                      </div>
                   </div>
                   {turn.betterAlternative && (
                      <div className="bg-emerald-50 p-3 rounded border border-emerald-100">
                          <span className="text-xs text-emerald-600 font-bold uppercase block mb-1">Better Alternative</span>
                          <p className="text-sm text-emerald-800 font-medium">"{turn.betterAlternative}"</p>
                      </div>
                   )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Plan */}
        <section className="break-inside-avoid">
          <h2 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wide border-b border-slate-200 pb-2">
              실천 과제 (Action Plan)
          </h2>
          <div className="space-y-3">
             {result.actionPlan.map((item, idx) => (
                <div key={idx} className="flex items-start bg-white border border-l-4 border-l-indigo-500 border-slate-200 p-4 rounded shadow-sm">
                   <div className="mr-4 mt-0.5 text-indigo-500 font-bold text-lg">{idx + 1}</div>
                   <div className="flex-1">
                      <h3 className="font-bold text-slate-800 mb-1">{item.task}</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500 mt-2">
                         <span className="flex items-center">
                           <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                           {item.deadline}
                         </span>
                         <span className="flex items-center">
                           <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           {item.metric}
                         </span>
                      </div>
                   </div>
                </div>
             ))}
          </div>
        </section>
        
        {/* Footer for Print */}
        <div className="mt-8 pt-8 border-t border-slate-200 text-center text-xs text-slate-400 hidden print:block">
           Generated by Situational Leadership Coach • LimeWorks
        </div>
      </div>

      {/* Control Buttons (Not Printed) */}
      <div className="mt-8 flex gap-4 justify-center print:hidden flex-wrap" data-html2canvas-ignore="true">
        <Button variant="outline" onClick={handleDownloadPDF} className="shadow-sm">
            <svg className="w-5 h-5 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            PDF 다운로드
        </Button>
        <Button variant="outline" onClick={handleSendEmail} className="shadow-sm">
            <svg className="w-5 h-5 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            이메일 발송
        </Button>
        <Button variant="secondary" onClick={onGoToDashboard}>
            {userName ? '홈으로' : '대시보드'}
        </Button>
        <Button onClick={onNewScenario} className="shadow-lg shadow-indigo-200">
            새로운 코칭 시작
        </Button>
      </div>
    </div>
  );
};